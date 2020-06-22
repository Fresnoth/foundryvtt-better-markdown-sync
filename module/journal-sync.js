"use strict";
import * as Constants from "./constants.js"
import * as Logger from './logger.js'
import * as FS from './journalFileSystem.js'

let markdownSourcePath;
let newImportedFiles = "";

export async function fetchParams(silent = false) {
    markdownSourcePath = game.settings.get(Constants.MODULE_NAME, "MarkdownSourcePath");
}

export async function initModule() {
    Logger.log("Init Module entered")
    //Logger.enableTracing();
    await fetchParams(true);

}

export async function readyModule() {
    Logger.log("Ready Module entered")
    await fetchParams();

    Logger.log(`markdownSourcePath: ${markdownSourcePath}`)
    Logger.log(`validmarkdownSourcePath(): ${await validmarkdownSourcePath()}`)

    // Create markdownSourcePath if not already there.
    let buildPath = '';
    validmarkdownSourcePath().split('/').forEach((path) => {
        buildPath += path + '/';
        FS.createDirectory("data", buildPath)
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
                FS.browse("data", validmarkdownSourcePath()).then((result) => {
                    // ChatMessage.create({content: JSON.stringify(result)});
                });

                console.log(game.journal);
                game.journal.forEach((value, key, map) => {
                    Logger.log(`m[${key}] = ${value.data.name} - ${value.data.folder} - ${value.data.content}`);
                });
                return false;
                break;


            case "export": // /js export

                let journalFolders = await createFolderTree(game.folders.filter(f => (f.data.type === "JournalEntry") && f.displayed))

                journalFolders.forEach(folderEntity => {
                    exportFolder(folderEntity, validmarkdownSourcePath());
                });

                game.journal.filter(f => (f.data.folder === "")).forEach((value, key, map) => {
                    Logger.log(`m[${key}] = ${value.data.name} - ${value.data.folder} - ${value.data.type}`);
                    exportJournal(value, validmarkdownSourcePath());
                });

                return false;
                break;

            case "import": // /js import
                await createJournalFolders(validmarkdownSourcePath(), null);
                let result = await FS.browse("data", validmarkdownSourcePath());
                for (let [key, file] of Object.entries(result.files)) {
                    await importFile(file);
                }
                for (let [key, folder] of Object.entries(result.dirs)) {
                    await importFolder(folder);
                }
                // FS.browse("data", validmarkdownSourcePath()).then((result) => {
                //     console.log(result);
                //     result.files.forEach(file => {
                //         importFile(file);
                //     });
                //     result.dirs.forEach(folder => {
                //         importFolder(folder);
                //     });
                // });



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
}

function validmarkdownSourcePath() {
    let validMarkdownSourcePath = markdownSourcePath.replace("\\", "/");
    validMarkdownSourcePath += validMarkdownSourcePath.endsWith("/") ? "" : "/";
    validMarkdownSourcePath += game.world.name + "/";
    return validMarkdownSourcePath;
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
    return fileName.replace(`(${getJournalIdFromFilename(fileName)}).md`, '');
}

function last(array) {
    return array[array.length - 1];
}

async function importFolder(importFolderPath) {
    Logger.logTrace(`Importing folder: ${importFolderPath}`);
    let result = await FS.browse("data", importFolderPath);

    for (let [key, file] of Object.entries(result.files)) {
        await importFile(file);
    }

    for (let [key, folder] of Object.entries(result.dirs)) {
        await importFolder(folder);
    }
}

// This will create the journal folder in FVTT
async function createJournalFolders(rootPath, parentFolderId) {
    //Logger.logTrace(`createJournalFolders | Params(folder = ${rootPath} parent = ${parentFolderId})`)
    let result = await FS.browse("data", rootPath)
    for (let [key, folder] of Object.entries(result.dirs)) {
        let thisFolderName = last(decodeURIComponent(folder).split('/'));
        let folderDetails = game.folders.filter(f => (f.data.type === "JournalEntry") && (f.data.name === thisFolderName) && (f.data.parent === parentFolderId));

        if (folderDetails.length == 0) {
            //Logger.logTrace(`createJournalFolders | Creating folder path: ${thisFolderName} parent: ${parentFolderId}`)
            //Logger.logTrace(`${JSON.stringify({ name: thisFolderName, type: "JournalEntry", parent: parentFolderId })}`);
            await Folder.create({ name: thisFolderName, type: "JournalEntry", parent: parentFolderId });
        }

        folderDetails = game.folders.filter(f => (f.data.type === "JournalEntry") && (f.data.name === thisFolderName) && (f.data.parent === parentFolderId));
        //Logger.logTrace(`createJournalFolders | folder: ${folder} thisFolderName: ${thisFolderName} folderDetails._id: ${folderDetails[0]._id} folderDetails: ${JSON.stringify(folderDetails)}`)

        createJournalFolders(folder, folderDetails[0]._id);
    }
}

async function importFile(file) {
    Logger.logTrace(`importFile | params(file = ${file})`);
    var journalPath = decodeURIComponent(file).replace(validmarkdownSourcePath(), '').trim();
    var journalId = getJournalIdFromFilename(journalPath).trim();
    var journalName = getJournalTitleFromFilename(last(journalPath.split('/'))).trim();
    var parentPath = journalPath.replace(last(journalPath.split('/')), '').trim();

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

    fetch('/' + file).then(response => {
        response.text().then(journalContents => {
            let updated = false;
            var converter = new showdown.Converter()
            let md = converter.makeHtml(journalContents);

            game.journal.filter(f => (f.id === journalId)).forEach((value, key, map) => {
                Logger.log(`Importing ${journalPath} with ID ${journalId} named ${journalName}`);
                value.update({ content: md });
                updated = true;
            });

            if (!updated) {
                Logger.log(`Creating ${journalPath} with ID ${journalId} named ${journalName}`);
                JournalEntry.create({ name: journalName, content: md, folder: currentParent }).then(journal => { journal.show(); });
                ChatMessage.create({ content: `Added ${journalName}, please run export and delete '${journalName}.md'` });
            }

        });

    });
}

async function exportFolder(folder, parentPath) {
    let folderPath = parentPath + '/' + folder.data.name;

    // Create folder directory on server. 
    FS.createDirectory("data", folderPath)
        .then((result) => {
            Logger.log(`Creating ${folderPath}`);
            folder.content.forEach(journalEntry => {
                exportJournal(journalEntry, folderPath);
            });
        })
        .catch((error) => {
            if (!error.includes("EEXIST")) {
                Logger.log(error);
            } else {
                Logger.log(`${folderPath} exists`);
                folder.content.forEach(journalEntry => {
                    exportJournal(journalEntry, folderPath);
                });
            }
        });


    // Recurse for any sub folders. 
    folder.children.forEach(folderEntity => {
        exportFolder(folderEntity, folderPath);
    });
}

async function exportJournal(journalEntry, parentPath) {
    // Export any journals in the folder.
    var converter = new showdown.Converter()
    let md = converter.makeMarkdown(journalEntry.data.content).split('\r\n');
    let journalFileName = generateJournalFileName(journalEntry);

    FS.upload("data", parentPath, new File(md, journalFileName), { bucket: null })
        .then((result) => {
            Logger.log(`Uploading ${parentPath}/${journalFileName}`);
        })
        .catch((error) => {
            Logger.log(error);
        });
}

async function createFolderTree(dataset) {
    let hashTable = Object.create(null);
    let dataTree = [];
    dataset.forEach(folderEntity => hashTable[folderEntity.id] = { ...folderEntity, childNodes: [] });

    dataset.forEach(folderEntity => {
        if (folderEntity.parent) {
            hashTable[folderEntity.parent.id].childNodes.push(hashTable[folderEntity.id]);
        } else {
            dataTree.push(hashTable[folderEntity.id]);
        }
    })
    return dataTree;
}

