"use strict";
import * as Constants from "./constants.js"
import * as Logger from './logger.js'
import { generateFolderStringsMap, exportFolderPath, generateCompendiumFoldersMap, exportFolderPathString } from './folder-utils.js'
import { journalV10prep, convertFVTTJnlLinksToMDLinks, convertHTMLtoMD, compendiumObjectsToCreate, cleanMDImageLinkPaths, addYAMLFrontMatter, journalV10prepALL, convertFVTTJnlLinksToMDLinksRefactor, addEmbeddedImageFromImgJournal, singleJournalPageV10prep } from './journal-utils.js'
import { actorPrepBase } from './actor-utils.js'
import { itemPrepBase } from './item-utils.js'

let markdownPathOptions, markdownSourcePath, journalEditorLink, importWorldPath, exportWorldPath;
let enableTracing = false;
let newImportedFiles = "";
let skippedJournalFolders, skippedJournalEntries;

// parses the string back to something the FilePicker can understand as an option
export function parse(str) {
  let matches = str.match(/\[(.+)\]\s*(.+)/);
  if (matches) {
    let source = matches[1];
    const current = matches[2].trim();
    const [s3, bucket] = source.split(":");
    if (bucket !== undefined) {
      return {
        activeSource: s3,
        bucket: bucket,
        current: current,
      };
    } else {
      return {
        activeSource: s3,
        bucket: null,
        current: current,
      };
    }
  }
  // failsave, try it at least
  return {
    activeSource: "data",
    bucket: null,
    current: str,
  };
}

export async function fetchParams(silent = false) {
    markdownPathOptions = parse(game.settings.get(Constants.MODULE_NAME, "MarkdownSourcePath"));
    markdownSourcePath = markdownPathOptions.current;

    journalEditorLink = game.settings.get(Constants.MODULE_NAME, "JournalEditorLink");
    enableTracing = game.settings.get(Constants.MODULE_NAME, "EnableTracing");
    
    importWorldPath = game.settings.get(Constants.MODULE_NAME, "ImportWorldPath");
    exportWorldPath = game.settings.get(Constants.MODULE_NAME, "ExportWorldPath");

    skippedJournalFolders = game.settings.get(Constants.MODULE_NAME, "SkipJournalFolders").split(',');
    skippedJournalEntries = game.settings.get(Constants.MODULE_NAME, "SkipJournalEntries").split(',');

    // If the entries are empty it will set the array to one empty string ""
    // This matches the root path where the folder name is also 
    // "" so blocked export/import. If nothing set put a name in that no
    // one in their right mind would use :)
    if(skippedJournalFolders.length == 1 && skippedJournalFolders[0] === "") {
        skippedJournalFolders[0] = "NOTHINGHASBEENSETTOSKIP";
    }
    if(skippedJournalEntries.length == 1 && skippedJournalEntries[0] === "") {
        skippedJournalEntries[0] = "NOTHINGHASBEENSETTOSKIP";
    }
}

/**
 * Runs during the init hook of Foundry
 *
 * During init the settings and trace logging is set.
 *
 */
export async function initModule() {
    Logger.log("Init Module entered")
    await fetchParams(true);
    if (enableTracing) {
        Logger.enableTracing();
    }
}

export async function readyModule() {
    Logger.log("Ready Module entered")
    await fetchParams();

    Logger.log(`markdownSourcePath: ${markdownSourcePath}`)
    Logger.log(`validMarkdownSourcePath(): ${await validMarkdownSourcePath()}`)

    // Create markdownSourcePath if not already there.
    let buildPath = '';
    validMarkdownSourcePath().split('/').forEach((path) => {
        buildPath += path + '/';
        FilePicker.createDirectory(markdownPathOptions.activeSource, buildPath)
            .then((result) => {
                Logger.log(`Creating ${buildPath}`);
            })
            .catch((error) => {
                if (!error.includes("EEXIST")) {
                    Logger.log(error);
                }
            });
    });

    Hooks.on("preCreateChatMessage", async (data, options, userId) => {
        if (data.content === undefined || data.content.length == 0) return;
        let content = data.content || "";
        if (!content.trim().startsWith("/js")) return;

        let command = content.replace("/js", "").trim();

        switch (command) {
            case "help":
                data.content = "HERE IS HELP!";
                return true;
                break;

            case "test": // /js test
                FilePicker.browse(markdownPathOptions.activeSource, "/").then((result) => {
                     ChatMessage.create({content: JSON.stringify(result)});
                });

                console.log(game.journal);
                game.journal.forEach((value, key, map) => {
                    Logger.log(`m[${key}] = ${value.data.name} - ${value.data.folder} - ${value.data.content}`);
                });
                return false;
                break;

            case "export": // /js export
                await startExport();
                return false;
                break;

            case "import": // /js import
                await startImport();
                return false;
                break;

            case "nukejournals":
                game.journal.forEach((value, key, map) => { JournalEntry.delete(value.id); });
                break;

            case "nukefolders":
                game.journal.forEach((value, key, map) => { JournalEntry.delete(value.id); });
                break;

            default:
                data.content = "HERE IS HELP!";
                return true;
                break;
        }
    });

    Hooks.on("getSceneControlButtons", (controls) => {
        let group = controls.find(b => b.name == "notes")
        group.tools.push({
            name: "import",
            title: "Import Journals",
            icon: "fas fa-file-import",
            onClick: () => {
                startImport();
            },
            button: true
        });
        group.tools.push({
            name: "export",
            title: "Export Journals",
            icon: "fas fa-file-export",
            onClick: () => {
                startExport();
            },
            button: true,
        });
        group.tools.push({
            name: "BMD",
            title: "BMD TEST",
            icon: "fas fa-file-export",
            onClick: () => {
                startExportAllJournals();
            },
            button: true,
        });

        group.tools.push({
            name: "BMDActor",
            title: "Actor Test",
            icon: "fas fa-file-export",
            onClick: () => {
                startExportActors();
            },
            button: true,
        });

        group.tools.push({
            name: "BMDItems",
            title: "Item Test",
            icon: "fas fa-file-export",
            onClick: () => {
                startExportItems();
            },
            button: true,
        });

        group.tools.push({
            name: "BMDSingleJournal",
            title: "Single Journal Test",
            icon: "fas fa-file-export",
            onClick: () => {
                startExportSingleJournal();
            },
            button: true,
        });

        if (journalEditorLink != "") {
            group.tools.push({
                name: "edit",
                title: "Edit Journals",
                icon: "fas fa-edit",
                onClick: () => {
                    window.open(journalEditorLink, "_blank");
                },
                button: true,
            });
        }
    });
}

async function startImport() {
    await createJournalFolders(validMarkdownSourcePath()+validImportWorldPath(), null);
    let result = await FilePicker.browse(markdownPathOptions.activeSource, validMarkdownSourcePath()+validImportWorldPath());
    for (let [key, file] of Object.entries(result.files)) {
        if(isValidFile(file)) {
            await importFile(file);
        }
    }
    for (let [key, folder] of Object.entries(result.dirs)) {
        await importFolder(folder);
    }

    
    ui.notifications.info("Import completed");
    // FilePicker.browse(markdownPathOptions.activeSource, validMarkdownSourcePath()).then((result) => {
    //     console.log(result);
    //     result.files.forEach(file => {
    //         importFile(file);
    //     });
    //     result.dirs.forEach(folder => {
    //         importFolder(folder);
    //     });
    // });
}

async function startExport() {
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);
    
    //may need to tighten this execution to for .. of loop to prevent the rest of everything running ahead?
    game.folders.forEach(folder => {
        exportFolderPath(folder, validMarkdownSourcePath()+validExportWorldPath(),folder_map, markdownPathOptions);
    });

    let pageArray = await journalV10prep(game.journal.get('jusKa3qmhyxf2sd5'),folder_map);
    console.log(pageArray);

    let i = 0;
    while (i < pageArray.length){
        pageArray[i].markdown = await convertHTMLtoMD(pageArray[i].htmltext);
        pageArray[i].markdown = await convertFVTTJnlLinksToMDLinks(pageArray[i].markdown,pageArray[i],folder_map);
        i++;
    }

    i = 0;
    while (i < pageArray.length){
        let cleanererText = await cleanMDImageLinkPaths(pageArray[i].markdown);
        console.log(cleanererText);
        i++;
    }

    for(let i = 0; i < pageArray.length; i++){
        let someNewText = await addYAMLFrontMatter(pageArray[i].markdown, pageArray[i])
        console.log(someNewText);
    }

    console.log(pageArray);

    let blob = new Blob([pageArray[0].markdown], {type: "text/markdown"});
    let file = new File([blob], pageArray[0].name+'.md', {type: "text/markdown"});

    FilePicker.upload(markdownPathOptions.activeSource, validMarkdownSourcePath()+validExportWorldPath()+pageArray[0].folderPath, file, { bucket: null })
        .then((result) => {
            Logger.log(`Uploading ${parentPath}/${pageArray[0].name}`);
        })
        .catch((error) => {
            Logger.log(error);
        });

    console.log(compendiumObjectsToCreate);
    /*
    let journalFolders = await createFolderTree(game.folders.filter(f => (f.type === "JournalEntry") && f.displayed))
        console.log(journalFolders);
    journalFolders.forEach(folderEntity => {
        console.log("im in here");
        exportFolder(folderEntity, validMarkdownSourcePath()+validExportWorldPath());
    });

    game.journal.filter(f => (f.folder === "")).forEach((value, key, map) => {
        Logger.logTrace(`m[${key}] = ${value.name} - ${value.folder} - ${value.type}`);
        //exportJournal(value, validMarkdownSourcePath()+validExportWorldPath());
    });*/
    ui.notifications.info("Export completed");
}

async function startExportAllJournals(){
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);
    
    //may need to tighten this execution to for .. of loop to prevent the rest of everything running ahead?
    game.folders.forEach(folder => {
        exportFolderPath(folder, validMarkdownSourcePath()+validExportWorldPath(),folder_map, markdownPathOptions);
    });

    let pageArray = await journalV10prepALL(folder_map);
    let imageArray = pageArray.filter(p => (p.type === 'image'));
    let txtPageArray = pageArray.filter(p => (p.type === 'text'));

    for(let i = 0; i < txtPageArray.length; i++){
        txtPageArray[i].markdown = await convertHTMLtoMD(txtPageArray[i].htmltext);
        txtPageArray[i].markdown = await convertFVTTJnlLinksToMDLinksRefactor(txtPageArray[i].markdown,txtPageArray[i],folder_map);
        txtPageArray[i].markdown = await cleanMDImageLinkPaths(txtPageArray[i].markdown);
        txtPageArray[i].markdown = await addYAMLFrontMatter(txtPageArray[i].markdown, txtPageArray[i]);
        //console.log(txtPageArray[i].markdown);
    }
    
    for(let i = 0; i < imageArray.length; i++){
        imageArray[i].markdown = await addEmbeddedImageFromImgJournal(imageArray[i]);
        imageArray[i].markdown = await addYAMLFrontMatter(imageArray[i].markdown, imageArray[i]);
        //console.log(imageArray[i].markdown);
    }
    console.log(pageArray);
    console.log(compendiumObjectsToCreate);
    await createCompendiumFiles();

   for(let i = 0; i < pageArray.length; i++){
        await writeFileToSystem(pageArray[i]);
    }
    
}


async function startExportSingleJournal(){
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);

        //may need a check here for a hedding # identifier?  Not sure if we are cleaning this before this step
        let jpObj = await game.journal.get("GzFr880LIgxWfEIq");
        console.log(jpObj);
        let singlejp = await journalV10prep(jpObj,folder_map,false);
        for(let i=0;i<singlejp.length;i++){
            console.log(singlejp[i]);
            console.log(singlejp[i].htmltext);
            singlejp[i].markdown = await convertHTMLtoMD(singlejp[i].htmltext);
            console.log(singlejp[i].markdown);
            singlejp[i].markdown = await convertFVTTJnlLinksToMDLinksRefactor(singlejp[i].markdown,singlejp[i],folder_map);
            console.log(singlejp[i].markdown);
            singlejp[i].markdown = await cleanMDImageLinkPaths(singlejp[i].markdown);
            console.log(singlejp[i].markdown);
            singlejp[i].markdown = await addYAMLFrontMatter(singlejp[i].markdown, singlejp[i]);
            console.log(singlejp[i].markdown);
        }
        //writeFileToSystem(singlejp);
}

//given a uuid run all things needed to export the page and return the data
/*async function startExportSingleJournalPage(){
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);

        //may need a check here for a hedding # identifier?  Not sure if we are cleaning this before this step
        let jpObj = await game.journal.get("GzFr880LIgxWfEIq");
        console.log(jpObj);
        let singlejp = await journalV10prep(jpObj,folder_map,false);
        for(let i=0;i<singlejp.length;)
        console.log(singlejp);
        console.log(singlejp.htmltext);
        singlejp.markdown = await convertHTMLtoMD(singlejp.htmltext);
        console.log(singlejp.markdown);
        singlejp.markdown = await convertFVTTJnlLinksToMDLinksRefactor(singlejp.markdown,singlejp,folder_map);
        console.log(singlejp.markdown);
        singlejp.markdown = await cleanMDImageLinkPaths(singlejp.markdown);
        console.log(singlejp.markdown);
        singlejp.markdown = await addYAMLFrontMatter(singlejp.markdown, singlejp);
        console.log(singlejp.markdown);
        //writeFileToSystem(singlejp);
}*/

async function pageArrayHandler(pageArray,folder_map){
    let imageArray = pageArray.filter(p => (p.type === 'image'));
    let txtPageArray = pageArray.filter(p => (p.type === 'text'));

    for(let i = 0; i < txtPageArray.length; i++){
        txtPageArray[i].markdown = await convertHTMLtoMD(txtPageArray[i].htmltext);
        txtPageArray[i].markdown = await convertFVTTJnlLinksToMDLinksRefactor(txtPageArray[i].markdown,txtPageArray[i],folder_map);
        txtPageArray[i].markdown = await cleanMDImageLinkPaths(txtPageArray[i].markdown);
        txtPageArray[i].markdown = await addYAMLFrontMatter(txtPageArray[i].markdown, txtPageArray[i]);
        //console.log(txtPageArray[i].markdown);
    }
    
    for(let i = 0; i < imageArray.length; i++){
        imageArray[i].markdown = await addEmbeddedImageFromImgJournal(imageArray[i]);
        imageArray[i].markdown = await addYAMLFrontMatter(imageArray[i].markdown, imageArray[i]);
        //console.log(imageArray[i].markdown);
    }
    return pageArray;
}

async function createCompendiumFiles(){
    
    let compMap = await generateCompendiumFoldersMap(compendiumObjectsToCreate);
    console.log(compMap);
    for (let value of compMap.values()){
        await exportFolderPathString(value,validMarkdownSourcePath()+validExportWorldPath(),markdownPathOptions);
    }

    let compActors = compendiumObjectsToCreate.filter(a => (a.type === 'Actor'));
    let compActorsMap = new Map();
    for(let i= 0; i<compActors.length; i++){
        compActorsMap.set(compActors[i].UUID,compActors[i].type);
    }
    console.log(compActorsMap);
    for(let key of compActorsMap.keys()){
        let actObj = await fromUuid(key);
        let singleActor = await actorPrepBase(actObj,compMap,true);
        //writeFileToSystem(singleActor);
        //console.log(singleActor);
    }

    let compJournals = compendiumObjectsToCreate.filter(j => (j.type === 'JournalEntry'));
    let compJournalsMap = new Map();
    let compJournalsPageMap = new Map();
    console.log(compJournals);
    for(let i= 0; i<compJournals.length; i++){
        if(compJournals[i].UUID.includes('JournalEntryPage')){
            compJournalsPageMap.set(compJournals[i].UUID,'JournalEntryPage');
        }
        else{
            compJournalsMap.set(compJournals[i].UUID,compJournals[i].type);
        }
    }
    console.log(compJournalsMap);
    for(let key of compJournalsPageMap.keys()){
        //may need a check here for a hedding # identifier?  Not sure if we are cleaning this before this step
        let jpObj = await fromUuid(key);
        let singlejp = await singleJournalPageV10prep(jpObj,compJournalsPageMap,true);
        singlejp.markdown = await convertHTMLtoMD(singlejp.htmltext);
        singlejp.markdown = await convertFVTTJnlLinksToMDLinksRefactor(singlejp.markdown,singlejp,compJournalsPageMap);
        singlejp.markdown = await cleanMDImageLinkPaths(singlejp.markdown);
        singlejp.markdown = await addYAMLFrontMatter(singlejp.markdown, singlejp);
        writeFileToSystem(singlejp);
    }
    
    for(let key of compJournalsMap.keys()){
        //may need a check here for a hedding # identifier?  Not sure if we are cleaning this before this step
        let jObj = await fromUuid(key);
        let singlejArray = await journalPageV10prep(jObj,compJournalsPageMap,true);
        console.log(singlejArray);
        singlejArray = await pageArrayHandler(singlejArray,compJournalsMap);
        console.log(singlejArray);
    }
}

async function startExportActors(){
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);
    
    //may need to tighten this execution to for .. of loop to prevent the rest of everything running ahead?
    game.folders.forEach(folder => {
        exportFolderPath(folder, validMarkdownSourcePath()+validExportWorldPath(),folder_map, markdownPathOptions);
    });
    for(let value of game.actors.values()){
        let singleActor = await actorPrepBase(value,folder_map,false);
        console.log(singleActor);
        writeFileToSystem(singleActor);
    }
}

async function startExportItems(){
    let allTopLevelFolders = await game.folders.filter(f => (f.depth === 1) && f.displayed);
    let folder_map = await generateFolderStringsMap(allTopLevelFolders);
    Logger.log(folder_map);

    //may need to tighten this execution to for .. of loop to prevent the rest of everything running ahead?
    game.folders.forEach(folder => {
        exportFolderPath(folder, validMarkdownSourcePath()+validExportWorldPath(),folder_map, markdownPathOptions);
    });

    for(let value of game.items.values()){
        let singleItem = await itemPrepBase(value,folder_map,false);
        console.log(singleItem);
        writeFileToSystem(singleItem);
    }
//    let singleItem = await itemPrepBase(game.items.get("6SAOOfxrqNl6w1jY"),folder_map,false);
//    console.log(singleItem);
//    writeFileToSystem(singleItem);
}

//This function ensures that we always have a top folder like "Item" to place documents into
//Due to the way that we process folders in other functions if a particular Document Type has no folders but has items all the
//items will have a "null" folder and no top level folder will be created to hold those "folder-less" documents
async function topLevelFolderCreate(){
    let TOP_FOLDER_ARRAY = ['JournalEntry','Actor','Item','Scene','RollTable','Compendium'];
    for(let i=0;i<TOP_FOLDER_ARRAY.length;i++){
        exportFolderPathString(TOP_FOLDER_ARRAY[i],validMarkdownSourcePath()+validExportWorldPath(),markdownPathOptions);
    }
}

async function writeFileToSystem(docObj){
    let blob = new Blob([docObj.markdown], {type: "text/markdown"});
    let file = new File([blob], docObj.name+'.md', {type: "text/markdown"});

    FilePicker.upload(markdownPathOptions.activeSource, validMarkdownSourcePath()+validExportWorldPath()+docObj.folderPath, file, { bucket: null })
        .then((result) => {
            Logger.log(`Uploading ${validMarkdownSourcePath()+validExportWorldPath()+docObj.folderPath}/${docObj.name}`);
        })
        .catch((error) => {
            Logger.log(error);
        });
}

function validMarkdownSourcePath() {
    let validMarkdownSourcePath = markdownSourcePath.replace("\\", "/");
    validMarkdownSourcePath += validMarkdownSourcePath.endsWith("/") ? "" : "/";
//  validMarkdownSourcePath += game.world.name + "/"; -- 
    return validMarkdownSourcePath;
}

function validImportWorldPath() {
    let validImportWorldPath = importWorldPath == "" ? (game.world.id + "/") : importWorldPath;
    validImportWorldPath += validImportWorldPath.endsWith("/") ? "" : "/";
    return validImportWorldPath;
}

function validExportWorldPath() {
    let validExportWorldPath = exportWorldPath == "" ? (game.world.id + "/") : exportWorldPath;
    validExportWorldPath += validExportWorldPath.endsWith("/") ? "" : "/";
    return validExportWorldPath;
}

function isValidFile(filename) {
    return filename.endsWith('.md');
}

function isValidFileName(filename) {
    var re = /^(?!\.)(?!com[0-9]$)(?!con$)(?!lpt[0-9]$)(?!nul$)(?!prn$)[^\|\*\?\\:<>/$"]*[^\.\|\*\?\\:<>/$"]+$/
    return re.test(filename);
}

function generateJournalFileName(journalEntity) {
    return `${journalEntity.name} (${journalEntity.id}).md`
}

function getJournalIdFromFilename(fileName) {
    // 'sdfkjs dflksjd kljf skldjf(IDIDIDIID).md
    return last(fileName.split('(')).replace(').md', '');
}

function getJournalTitleFromFilename(fileName) {
    // 'sdfkjs dflksjd kljf skldjf(IDIDIDIID).md
    // Remove the ID if i is there and any .md remaining so it is just the file name with no extension.
    return fileName.replace(`(${getJournalIdFromFilename(fileName)}).md`, '').replace('.md', '');
}

function last(array) {
    return array[array.length - 1];
}

function hasJsonStructure(str) {
    if (typeof str !== 'string') return false;
    try {
        const result = JSON.parse(str);
        const type = Object.prototype.toString.call(result);
        return type === '[object Object]'
            || type === '[object Array]';
    } catch (err) {
        return false;
    }
}

async function importFolder(importFolderPath) {
    Logger.logTrace(`Importing folder: ${importFolderPath}`);
    let result = await FilePicker.browse(markdownPathOptions.activeSource, importFolderPath);

    for (let [key, file] of Object.entries(result.files)) {
        if(isValidFile(file)) {
            await importFile(file);
        }
    }

    for (let [key, folder] of Object.entries(result.dirs)) {
        await importFolder(folder);
    }
}

// This will create the journal folder in FVTT
async function createJournalFolders(rootPath, parentFolderId) {
    Logger.logTrace(`createJournalFolders | Params(folder = ${rootPath} parent = ${parentFolderId})`)
    let result = await FilePicker.browse(markdownPathOptions.activeSource, rootPath)
    for (let [key, folder] of Object.entries(result.dirs)) {
        let thisFolderName = last(decodeURIComponent(folder).split('/'));
        let folderDetails = game.folders.filter(f => (f.data.type === "JournalEntry") && (f.data.name === thisFolderName) && (f.data.parent === parentFolderId));

        if (folderDetails.length == 0) {
            Logger.logTrace(`createJournalFolders | Creating folder path: ${thisFolderName} parent: ${parentFolderId}`)
            Logger.logTrace(`${JSON.stringify({ name: thisFolderName, type: "JournalEntry", parent: parentFolderId })}`);
            await Folder.create({ name: thisFolderName, type: "JournalEntry", parent: parentFolderId });
        }

        folderDetails = game.folders.filter(f => (f.data.type === "JournalEntry") && (f.data.name === thisFolderName) && (f.data.parent === parentFolderId));
        Logger.logTrace(`createJournalFolders | folder: ${folder} thisFolderName: ${thisFolderName} folderDetails._id: ${folderDetails[0]._id} folderDetails: ${JSON.stringify(folderDetails)}`)

        createJournalFolders(folder, folderDetails[0]._id);
    }
}

async function importFile(file) {
    Logger.logTrace(`importFile | params(file = ${file})`);
    var journalPath = decodeURIComponent(file).replace(validMarkdownSourcePath()+validImportWorldPath(), '').trim();
    var pathUrl = (journalPath.startsWith('https://') ? new URL(journalPath) : '')
    if(pathUrl) {
        var tempPathArray = pathUrl.pathname.split("/");
        journalPath = tempPathArray.slice(2).join("/").replace(/\%20/gi," ");
    }
    var journalId = getJournalIdFromFilename(journalPath).trim();
    var journalName = getJournalTitleFromFilename(last(journalPath.split('/'))).trim();
    var parentPath = journalPath.replace(last(journalPath.split('/')), '').trim();

    if (skippedJournalEntries.includes(journalName) || skippedJournalFolders.includes(last(journalPath.split('/')))) {
        return;
    }

    let currentParent = null;

    if (parentPath != '') {
        let pathArray = parentPath.split('/');
        for (let index = 0; index < pathArray.length; index++) {

            const path = pathArray[index];
            if (path != '') {
                let folder = game.folders.filter(f => (f.data.type === "JournalEntry") && (f.data.name === path) && (f.data.parent === currentParent));
                currentParent = folder[0]._id;
                Logger.logTrace(`currentParent: '${currentParent}' path: '${path}' folder: '${JSON.stringify(folder)}' (${folder[0]._id}) '${typeof folder}' '${folder.length}'`);
            }
        }
    }

    Logger.logTrace(`'${file}','${journalPath}','${journalId}','${journalName}','${parentPath}','${currentParent}'`);

    if(!pathUrl) file = '/' + file;
    fetch(file).then(response => {
        response.text().then(journalContents => {
            let updated = false;
            let md = "";

            // If the contents is pure JSON ignore it as it may be used by 
            // a module as configuration storage.
            if (hasJsonStructure(journalContents)) {
                md = journalContents
            } else {
                var converter = new showdown.Converter({ tables: true, strikethrough: true })
                md = converter.makeHtml(journalContents);
            }

            game.journal.filter(f => (f.id === journalId)).forEach((value, key, map) => {
                Logger.log(`Importing ${journalPath} with ID ${journalId} named ${journalName}`);
                value.update({ content: md });
                updated = true;
            });

            if (!updated) {
                Logger.log(`Creating ${journalPath} named ${journalName}`);
                JournalEntry.create({ name: journalName, content: md, folder: currentParent }).then(journal => { journal.show(); });
                ChatMessage.create({ content: `Added ${journalName}, please run export and delete '${journalName}.md'` });
            }

        });

    });
}

async function exportJournal(journalEntry, parentPath) {
    if (skippedJournalEntries.includes(journalEntry.name) || skippedJournalFolders.includes(last(parentPath.split('/')))) {
        Logger.log(`Skipping ${journalEntry.name} as it matches exclusion rules`)
        return;
    }

    if(!isValidFileName(journalEntry.name)) {
        ChatMessage.create({ content: `Unable to export:<br /> <strong>${parentPath}/${journalEntry.name}</strong><br />It has invalid character(s) in its name that can not be used in file names.<br /><br /> These characters are invalid: <pre>| * ? \ : < > $</pre><br />Please rename the Journal Entry and export again.` });
    }
    

    let md = "";
    let journalFileName = generateJournalFileName(journalEntry);

    // If the contents is pure JSON ignore it as it may be used by 
    // a module as configuration storage.
    if (hasJsonStructure(journalEntry.data.content)) {
        Logger.log(`Detected JSON, skipping markdown conversion for '${journalFileName}' located at '${parentPath}'`);
        md = journalEntry.data.content.split('\r\n');
    } else {
        var converter = new showdown.Converter({ tables: true, strikethrough: true });
        md = converter.makeMarkdown(journalEntry.data.content).split('\r\n');
    }

    let blob = new Blob([md], {type: "text/markdown"});
    let file = new File([blob], journalFileName, {type: "text/markdown"});

    FilePicker.upload(markdownPathOptions.activeSource, parentPath, file, { bucket: null })
        .then((result) => {
            Logger.log(`Uploading ${parentPath}/${journalFileName}`);
        })
        .catch((error) => {
            Logger.log(error);
        });
}