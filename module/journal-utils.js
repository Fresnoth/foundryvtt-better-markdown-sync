import * as Logger from './logger.js';
import * as Constants from './constants.js';
import { makeStringSafe } from './folder-utils.js';

//import showdown from '../scripts/showdown.js';
//import { NodeHtmlMarkdown } from './node-html-markdown/dist/main';
export let compendiumObjectsToCreate = [];
const yaml_block_start = '---\n';
const yaml_block_end = '\n---\n';
const qu = '\"';
const el = '\n';
const tgel = '\n - ';

export async function prepJournalsExport(){
    /*
    game.journal.forEach(jentry => {
        console.log(jentry.folder._id)
    });*/
    cleanJounalObj = [];
}

export async function addYAMLFrontMatter(journalContent,objDoc){
    let yamlOut = yaml_block_start;
    yamlOut += 'FVTT_VER: '+qu+game.version+qu+el;
    switch(objDoc.docType){
        case 'JournalEntryPage':
            yamlOut += 'FVTT_ID: '+qu+objDoc.jEntryID+qu+el;
            yamlOut += 'FVTT_UUID: '+qu+'JournalEntry.'+objDoc.jEntryID+'.JournalEntryPage.'+objDoc.pageID+qu+el;
            yamlOut += 'FVTT_JE_NAME: '+qu+objDoc.unsafeJEName+qu+el; //this is currently string safe probably want to change to actual unless updating db
            yamlOut += 'FVTT_JEP_NAME: '+qu+objDoc.unsafeJEPageName+qu+el; //this is currently string safe probably want to change to actual unless updating db
            yamlOut += 'FVTT_JE_FORMAT: '+qu+objDoc.format+qu+el;
            yamlOut += 'FVTT_PAGE_TYPE: '+qu+objDoc.type+qu+el;
            break;
        case 'Actor':
            yamlOut += 'FVTT_ID: '+qu+objDoc._id+qu+el;
            yamlOut += 'FVTT_UUID: '+qu+'Actor.'+objDoc._id+qu+el;
            yamlOut += 'aliases: '+'['+objDoc.name.split(' ')+']'+el;
            break;
        case 'Item':
            yamlOut += 'FVTT_ID: '+qu+objDoc._id+qu+el;
            yamlOut += 'FVTT_UUID: '+qu+'Item.'+objDoc._id+qu+el;
            yamlOut += 'FVTT_ITEM_TYPE: '+qu+objDoc.type+qu+el;
            break;
        case 'Scene':
            break;
        case 'RollTable':
            break;
    }
    yamlOut += "tags: " + tgel + "BMD-Sync" + tgel + objDoc.docType + tgel + game.world.id + tgel + game.world.system;
    yamlOut += yaml_block_end;
    yamlOut += journalContent;
    return yamlOut;
}

export async function addEmbeddedImageFromImgJournal(jObj){
    let preworldpath = ''
    let imgpathArray = jObj.imgpath.split('/');
    if(imgpathArray[0] == 'icons'){ // if icons is the first folder in the list this is most likely not in the user data folder and is instead in the Foundry Public folder
        //need to work on copying "VALIDMARKDOWNSOURCEPATH logic an applying to these new user accessible game settings"
        preworldpath = game.settings.get(Constants.MODULE_NAME, 'SSHMappedDrive')+game.settings.get(Constants.MODULE_NAME, 'FoundryInstallSourcePath'); //'C:/Program Files/Foundry Virtual Tabletop/resources/app/public/'
    }
    else{
        preworldpath = game.settings.get(Constants.MODULE_NAME, 'SSHMappedDrive')+game.settings.get(Constants.MODULE_NAME, 'FoundryDataSourcePath'); // 'C:/Users/zairf/AppData/Local/FoundryVTT/Data/'
    }
    let outgoingStr = '![Image]('+String(preworldpath+jObj.imgpath).replace(/\s+/g, '%20')+')'
    return outgoingStr;
}

export async function cleanMDImageLinkPaths(journalContent) {
    const embededMDImageRegex = new RegExp('!\\[null\\]\\(<(?<BadLink>.+?)>\\)', 'gu')
    let incomingStr = journalContent;
    const matches = incomingStr.matchAll(embededMDImageRegex);
    let linkMap = new Map();
    let preworldpath = game.settings.get(Constants.MODULE_NAME, 'SSHMappedDrive')+game.settings.get(Constants.MODULE_NAME, 'FoundryDataSourcePath'); //'C:/Users/zairf/AppData/Local/FoundryVTT/Data/'
    for (const match of matches){
        linkMap.set(match[0], '![Image]('+String(preworldpath+match.groups.BadLink).replace(/\s+/g, '%20')+')');
        Logger.log(match[0]);
    }
    //console.log(linkMap);
    ///iterate through map and then str replace all links with the appropriate ids
    let outgoingStr = incomingStr;
    //Logger.log(outgoingStr);
    linkMap.forEach((value,key) => {
        outgoingStr = outgoingStr.replaceAll(key,value);
    });
    //Logger.log(outgoingStr);
    //console.log(outgoingStr);
    return outgoingStr;
}

async function MDLinkHelper(docObj,foldermap,origDocObj,match,matchedUserText,matchedDocType,preworldpath){
    let isWiki = true;
    if(docObj != undefined){ //check to make sure we are in the right place
        if(docObj.folder != null){
            let path = foldermap.get(docObj.folder._id);
            let link = await MDLinkType(matchedUserText,preworldpath,path,makeStringSafe(docObj.name),isWiki);
            return link //'['+matchedUserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(docObj.name).replace(/\s+/g, '%20')+'.md)';
        }
        else{ //This is a document that is not in a folder at all
            let link = await MDLinkType(matchedUserText,preworldpath,matchedDocType,makeStringSafe(docObj.name),isWiki);
            return link //'['+matchedUserText+']('+preworldpath+'/'+matchedDocType+'/'+makeStringSafe(docObj.name).replace(/\s+/g, '%20')+'.md)';
        }
    }
    else{
        Logger.logError(`This is a bad link like thing and will not be replaced: ${match[0]} it is in ${origDocObj.name} if you would like to fix manually`);
        return null;
    }
}

async function MDLinkType(usertext,preworldpath,path,name,isWikiStyle){
    if(isWikiStyle){
        let link = '[['+preworldpath+'/'+path+'/'+name+'|'+usertext+']]';
        return link;
    }
    else{
        let link = '['+usertext+']('+preworldpath+'/'+path+'/'+name.replace(/\s+/g, '%20')+'.md)';
        return link;
    }
}
//Specific Header in a Journal Entry Page Format: @UUID[.VoKPynzEvqDCnUKJ#02:-trial-by-fire]{02: Trial By Fire}
//This function will handle taking content and then going through and replacing all the links with the appropriate Markdown style link format
//This is still not the best implemntation and will need to be updated to UUID's can can be trimed a bit.
export async function convertFVTTJnlLinksToMDLinksRefactor(journalContent,journalPageObj,foldermap){
    //Logger.log(`Converting Links for: ${journalContent}`); // prints full MD to console
    let incomingStr = journalContent;
    const regexForProperlyFormedFVTTLinks = new RegExp('@(?<DocType>.+?)\\[(?<DocID>.+?)\\]\\{(?<UserText>.+?)\\}', 'gu');
    const matches = incomingStr.matchAll(regexForProperlyFormedFVTTLinks);
    let isWiki = true;
    //let preworldpath = game.settings.get(Constants.MODULE_NAME, 'FoundryDataSourcePath')+game.settings.get(Constants.MODULE_NAME, 'MarkdownSourcePath')+game.world.id; //'C:/Users/zairf/AppData/Local/FoundryVTT/Data/fvtt-md-sync/spelljammer'; //game.settings.get("bmd-sync","") // not currently using may in future
    let preworldpath = game.world.id;
    let linkMap = new Map();
    for (const match of matches){
        //console.log(match.groups.DocType);
        let matchedDoc = String(match.groups.DocType);
        let path = '';
        if(matchedDoc == 'JournalEntry' || matchedDoc == 'Actor' || matchedDoc == 'Item' || matchedDoc == 'Scene' || matchedDoc == 'RollTable'){
            let Obj = undefined;
            switch(matchedDoc){
                case 'JournalEntry':
                    Obj = await game.journal.get(match.groups.DocID);
                    break;
                case 'Actor':
                    Obj = await game.actors.get(match.groups.DocID);
                    break;
                case 'Item':
                    Obj = await game.items.get(match.groups.DocID);
                    break;
                case 'Scene':
                    Obj = await game.scenes.get(match.groups.DocID);
                    break;
                case 'RollTable':
                    Obj = await game.tables.get(match.groups.DocID);
                    break;
            }
            let newLinkText = await MDLinkHelper(Obj,foldermap,journalPageObj,match,match.groups.UserText,match.groups.DocType,preworldpath);
            if(newLinkText != null){
                linkMap.set(match[0],newLinkText);
            }
        }
        else{

        switch(matchedDoc){
            
            case 'Compendium':
                let compArray = String(match.groups.DocID).split('.');
                let compObjType = await game.packs.get(compArray[0]+'.'+compArray[1]).metadata.type;
                //Logger.log(`Comp First Part: ${compArray[0]} Comp Sec Part: ${compArray[1]} Comp Third Part: ${compArray[2]}`);
                //handles links in the following format: @Compendium[dnd5e.rules.Using Each Ability]{Persuasion}
                let compObj = await game.packs.get(compArray[0]+'.'+compArray[1]).getDocuments({name: compArray[2]});
                let isId = false;
                if(compObj.length == 0){ //this may be a v10 compendium link in the following format: @Compendium[shared-compendiums.monsters.Diu6omW9EaXznO3r]{astral blights}
                    compObj = await game.packs.get(compArray[0]+'.'+compArray[1]).getDocument(compArray[2]);
                    console.log(compObj);
                    if(compObj != null){
                        isId = true;
                        console.log(isId);
                    }
                }
                path = matchedDoc + '/' + compArray[0] + '/' + compArray[1];
                //THIS WILL NEED A CHECK HERE TO SEE IF THE COMPENDIUM RESULT IS A JOURNAL ENTRY, if so in V10 the entry may be pointing to a PAGE now and not a JE itself
                if(parseFloat(await game.world.coreVersion) >= 10 && compObjType == 'JournalEntry'){
                    //we have a "@COMPENDIUM" JournalEntry link in version 10, compendium links are hopefully being migrated to UUID in 10 for the most part but this is a catch in case there is an older JE in a v10 environment    
                    let compDocList = await game.packs.get(compArray[0]+'.'+compArray[1]).getDocuments();
                    compDocList.forEach(j => {
                        j.collections.pages.forEach(p=>{
                            if(p != undefined){
                                if(compArray[2] == p.name){
                                    //let  linktext = MDLinkType(match.groups.UserText,preworldpath,path,makeStringSafe(p.name),isWiki);
                                    linkMap.set(match[0], '['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(p.name).replace(/\s+/g, '%20')+'.md)');//'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(p.name).replace(/\s+/g, '%20')+'.md)'
                                    compendiumObjectsToCreate.push(
                                        {
                                            type: compObjType,
                                            UUID: p.uuid
                                        });
                                }
                            }
                        });
                    });
                }
                else{
                    //Need to add any compendium links to an object so that it can then have documents / folders created
                    console.log(isId);
                    if(compObj.length == 1){
                        //let linkText = MDLinkType(match.groups.UserText,preworldpath,path,makeStringSafe(compObj[0].name),isWiki);
                        linkMap.set(match[0], '['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(compObj[0].name).replace(/\s+/g, '%20')+'.md)');//'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(compObj[0].name).replace(/\s+/g, '%20')+'.md)');
                        compendiumObjectsToCreate.push(
                            {
                                type: compObjType,
                                UUID: compObj[0].uuid
                            });
                    }
                    else{
                        if(isId){ // these are links formatted like this @Compendium[shared-compendiums.monsters.Diu6omW9EaXznO3r]{astral blights}
                            linkMap.set(match[0], '['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(compObj.name).replace(/\s+/g, '%20')+'.md)');//'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(compObj[0].name).replace(/\s+/g, '%20')+'.md)');
                            compendiumObjectsToCreate.push(
                                {
                                    type: compObjType,
                                    UUID: compObj.uuid
                                });
                        }
                        //console.log(compObj)
                        Logger.logError(`Document ${compObj[0]} in ${match.groups.DocID} has multiple matches for its name or was not found, please make its name unique and its link in the document is correct.  Otherwise it will not be handled or exported.`);
                    }
                }
                break;
            //UUID compendium JE Page = @UUID[Compendium.dnd5e.rules.t6scHTmpmHBTZGTX.JournalEntryPage.eWXjNMjX1tZIFEuq]{Madness}
            //UUID JE Page Link with header: @UUID[JournalEntry.i0UPs1SvUDwQkGye.JournalEntryPage.1HAwbpvg7c031SyW#TroubleattheDocks]{“Trouble at the Docks”}
            case 'UUID':
                let uuidString = match.groups.DocID;
                if(uuidString.includes('#')){
                    //this is most likely a v10 journal entry page link in world or in compendium that will link directly to a header
                    //We are going to have to assume here that the { } text is the actual header since FVTT is doing something with removing spaces and is able to resolve
                    let uuidIDArray = uuidString.split('#');
                    let uuidObj = await fromUuid(uuidIDArray[0]);
                    let uuidArray = uuidString.split('.');
                    let wikiLink = '';
                    if(uuidObj != undefined){ //we check to make sure we find an object, we may not find it due to this being a broken link or bad parse information
                        if(uuidArray[0] == 'JournalEntry'){
                            if(uuidObj.parent.folder != null){
                                let path = foldermap.get(uuidObj.parent.folder._id);
                                wikiLink = await headerLinkHelper(uuidIDArray[1],path,uuidObj,match.groups.UserText);
                                linkMap.set(match[0],wikiLink);
                                //linkMap.set(match[0],'[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+match.groups.UserText+'|'+match.groups.UserText+']]');
                            }
                            else{
                                let path = 'JournalEntry';
                                wikiLink = await headerLinkHelper(uuidIDArray[1],path,uuidObj,match.groups.UserText);
                                linkMap.set(match[0],wikiLink);
                                //linkMap.set(match[0],'[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+match.groups.UserText+'|'+match.groups.UserText+']]');
                            }
                        }
                        if(uuidArray[0]== 'Compendium'){
                            let path = uuidArray[0] + '/' + uuidArray[1] + '/' + uuidArray[2];
                            wikiLink = await headerLinkHelper(uuidIDArray[1],path,uuidObj,match.groups.UserText);
                            linkMap.set(match[0],wikiLink);
                            //linkMap.set(match[0], '[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+match.groups.UserText+'|'+match.groups.UserText+']]');
                            let compUuidObjType = await game.packs.get(uuidArray[1]+'.'+uuidArray[2]).metadata.type;
                            compendiumObjectsToCreate.push(
                                {
                                    type: compUuidObjType,
                                    UUID: uuidObj.uuid
                                });
                        }
                    }
                    else{
                        Logger.logError(`Document ${uuidIDArray[0]} in ${match.groups.DocID} was not found, its link in the document may be broken.  It will not be handled or exported.`);
                    }
                }
                else{
                    let uuidArray = uuidString.split('.');
                    let uuidObj = await fromUuid(uuidString);
                    if(uuidObj != undefined){
                        if(uuidArray[0] == 'JournalEntry' || uuidArray[0] == 'Actor' || uuidArray[0] == 'RollTable' || uuidArray[0] == 'Scene' || uuidArray[0] == 'Item' ){
                            let newLinkText = await MDLinkHelper(uuidObj,foldermap,journalPageObj,match,match.groups.UserText,uuidArray[0],preworldpath);
                            if(newLinkText != null){
                                linkMap.set(match[0],newLinkText);
                            }
                        }
                        else{
                            if(uuidArray[0] == 'Compendium'){
                                let path = uuidArray[0] + '/' + uuidArray[1] + '/' + uuidArray[2];
                                let compUuidObjType = await game.packs.get(uuidArray[1]+'.'+uuidArray[2]).metadata.type;
                                let linktext = await MDLinkType(match.groups.UserText,preworldpath,path,makeStringSafe(uuidObj.name),isWiki);
                                linkMap.set(match[0],linktext);//'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(uuidObj.name).replace(/\s+/g, '%20')+'.md)');
                                compendiumObjectsToCreate.push(
                                    {
                                        type: compUuidObjType,
                                        UUID: uuidObj.uuid
                                    });
                            }
                        }
                    }
                    else{
                        Logger.logError(`Document ${uuidArray[0]} in ${match.groups.DocID} was not found, its link in the document may be broken.  It will not be handled or exported.`);
                    }
                    Logger.log(uuidArray);
                }
                //let uuidArray = uuidString.split('#')
                //let uuidObj = await fromUuid();

                //console.log(uuidObj);
                break;                  
        }
        }

        //console.log(match.groups.DocType);
        //console.log(match.groups.DocID);
        //console.log(match.groups.UserText);
        //console.log(match[0]);
    }
    //console.log(linkMap);
    ///iterate through map and then str replace all links with the appropriate ids
    let outgoingStr = incomingStr;
    linkMap.forEach((value,key) => {
        outgoingStr = outgoingStr.replaceAll(key,value);
    });
    //console.log(outgoingStr);
    return outgoingStr;
    //console.log(outgoingStr);
    ///iterate through map and then str replace all links with the appropriate ids
}

//this function takes in information from a link that is linking to a header specifically, this is a new feature of FVTT v10.
//it should be noted that if this is a v10.285 or earlier slug where the words were just concatenated and the user has modified the user text it will output a "broken" link within the exported markdown.
//example of this type of link =  @UUID[JournalEntry.i0UPs1SvUDwQkGye.JournalEntryPage.lSUKtoIsGOyEvb5W#4BridgeFloor]{area 4}  
//It is impossible to solve for this unless we dig through the JournalEntryPage._element for the HTML anchors where the slugified data is stored in sub collections, however this is less than ideal and any
//change made to the way the HTML is structured by FVTT would potentially cause a fatal break, since this is such an edge case we are currently comfortable with not handling this type of "break" and letting the end user deal with it
//unfortunately we have no way of knowing if the link will be "broken" so we can't alert the user to the potential other than noting this in documentation.
async function headerLinkHelper(slugifiedHeader,path,uuidObj,usertext){
    let link = '';
    if(slugifiedHeader.includes(' ')){ // handles header links like this where user defined text is not actually the header: @UUID[Compendium.dnd5e.rules.0AGfrwZRzSG0vNKb.JournalEntryPage.xt6tSGvU9e0vtXw6#Intelligence Checks]{Investigation}
        link = '[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+slugifiedHeader+'|'+usertext+']]';
    }
    else{
        if(slugifiedHeader.includes('-')){ // handles header links like this where user defined text is the same or different and it is using a v10.286+ slugify on the link after the # @UUID[Compendium.dnd5e.rules.0AGfrwZRzSG0vNKb.JournalEntryPage.OcHhrKKzffcVi03Q#group-checks]{Group Checks}
            link = '[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+slugifiedHeader.replaceAll('-',' ')+'|'+usertext+']]';
        }
        else{ //fall back in case it is a v10.285 or earlier slugify but the user text is correct to the header we are trying to link to @UUID[JournalEntry.GzFr880LIgxWfEIq.JournalEntryPage.AXigaOPwvQgBKeoG#RightintotheAction]{Right into the Action}
            link = '[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+usertext+'|'+usertext+']]';
        }
    }
    return link; //linkMap.set(match[0],'[['+path+'/'+makeStringSafe(uuidObj.name)+'#'+match.groups.UserText+'|'+match.groups.UserText+']]');
}

//This function will handle taking content and then going through and replacing all the links with the appropriate Markdown style link format
//This is still not the best implemntation and will need to be updated to UUID's can can be trimed a bit.
export async function convertFVTTJnlLinksToMDLinks(journalContent,journalPageObj,foldermap){
    //Logger.log(`Converting Links for: ${journalContent}`);
    let incomingStr = journalContent;
    const regexForProperlyFormedFVTTLinks = new RegExp('@(?<DocType>.+?)\\[(?<DocID>.+?)\\]\\{(?<UserText>.+?)\\}', 'gu');
    const matches = incomingStr.matchAll(regexForProperlyFormedFVTTLinks);
    let preworldpath = 'C:/Users/zairf/AppData/Local/FoundryVTT/Data/spelljammer/fvtt-md-sync'; //game.settings.get("bmd-sync","") // not currently using may in future
    let linkMap = new Map();
    for (const match of matches){
        //console.log(match.groups.DocType);
        let matchedDoc = String(match.groups.DocType);
        let path = '';
        switch(matchedDoc){
            case 'JournalEntry':
                //console.log(match[0]);
                //console.log(match.groups.DocID)
                //let obj = await game.journal.get(match.groups.DocID);
                //console.log(obj);
                let jObj = await game.journal.get(match.groups.DocID);
                //console.log(jObj);
                if(jObj != undefined){ //check to make sure we are in the right place
                    if(jObj.folder != null){
                        path = foldermap.get(jObj.folder._id);
                        linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(journalPageObj.name).replace(/\s+/g, '%20')+'.md)');
                    }
                    else{ //This is a document that is not in a folder at all
                        linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+match.groups.DocType+'/'+makeStringSafe(journalPageObj.name).replace(/\s+/g, '%20')+'.md)');
                    }
                }
                else{
                    Logger.log(`This is a bad link like thing and will not be replaced: ${match[0]} it is in ${journalPageObj.name} if you would like to fix manually`)
                }
                break;
            case 'Actor':
                //need a catch here for undefined response?
                let aObj = await game.actors.get(match.groups.DocID);
                let newLinkText = await MDLinkHelper(aObj,foldermap,journalPageObj,match.groups.UserText,match.groups.DocType,preworldpath);
                if(newLinkText != null){
                    linkMap.set(match[0],newLinkText);
                }
                //path = foldermap.get(aObj.folder._id);
                //linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(aObj.namee).replace(/\s+/g, '%20')+'.md)');
                break;
            case 'Item':
                let iObj = await game.items.get(match.groups.DocID);
                path = foldermap.get(iObj.folder._id);
                linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(iObj.namee).replace(/\s+/g, '%20')+'.md)');
                break;
            case 'Scene':
                let sObj = await game.scenes.get(match.groups.DocID);
                path = foldermap.get(sObj.folder._id);
                linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(sObj.namee).replace(/\s+/g, '%20')+'.md)');
                break;
            case 'RollTable':
                let rtObj = await game.tables.get(match.groups.DocID);
                path = foldermap.get(rtObj.folder._id);
                linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(rtObj.name).replace(/\s+/g, '%20')+'.md)');
                break;
            case 'Compendium':
                let compArray = String(match.groups.DocID).split('.');
                Logger.log(`Comp First Part: ${compArray[0]} Comp Sec Part: ${compArray[1]} Comp Third Part: ${compArray[2]}`);
                let compObj = await game.packs.get(compArray[0]+'.'+compArray[1]).getDocuments({name: compArray[2]});
                //THIS WILL NEED A CHECK HERE TO SEE IF THE COMPENDIUM RESULT IS A JOURNAL ENTRY, if so in V10 the entry may be pointing to a PAGE now and not a JE itself
                Logger.log(compObj);
                path = matchedDoc + '/' + compArray[0] + '/' + compArray[1];
                //Need to add any compendium links to an object so that it can then have documents / folders created
                if(compObj.length == 1){
                    linkMap.set(match[0],'['+match.groups.UserText+']('+preworldpath+'/'+path+'/'+makeStringSafe(compObj[0].name).replace(/\s+/g, '%20')+'.md)');
                    compendiumObjectsToCreate.push(
                        {
                            type: await game.packs.get(compArray[0]+'.'+compArray[1]).metadata.type,
                            UUID: compObj[0].uuid
                        });
                }
                else{
                    Logger.logError(`Document ${compObj[0]} in ${match.groups.DocID} has multiple matches for its name or was not found, please make its name unique and its link in the document is correct.  Otherwise it will not be handled or exported.`);
                }
                break;
                //@UUID[JournalEntry.i0UPs1SvUDwQkGye.JournalEntryPage.1HAwbpvg7c031SyW#TroubleattheDocks]{“Trouble at the Docks”}
            case 'UUID':
                let uuidObj = await fromUuid(match.groups.DocID);
                let uuidArray = match.groups.DocID.split('.');

                console.log(uuidObj);
                break;
        }
        //console.log(match.groups.DocType);
        //console.log(match.groups.DocID);
        //console.log(match.groups.UserText);
        //console.log(match[0]);
    }
    //console.log(linkMap);
    ///iterate through map and then str replace all links with the appropriate ids
    let outgoingStr = incomingStr;
    linkMap.forEach((value,key) => {
        outgoingStr = outgoingStr.replaceAll(key,value);
    });
    //console.log(outgoingStr);
    return outgoingStr;
    //console.log(outgoingStr);
    ///iterate through map and then str replace all links with the appropriate ids
}

//This function will take an incoming text string and search for badly formed FVTT links in the format @JournalEntry[SOME TEXT HERE]{Something}
//The conversion will go thought and put the appropriate FVTT Document ID in for the text between the brackets @JournalEntry[DocumentID]{Something}
//This function should be proceeded by running the content through the prepBadHTMLLinks
//if this is run out of order the regex may destroy significant portions of the document or just break
async function addJournalLinksIds(journalContent){
    if(journalContent != undefined){
    let incomingStr = journalContent;
    const regexForProperlyFormedFVTTLinks = new RegExp('@(?<DocType>.+?)\\[(?<DocID>.+?)\\]\\{(?<UserText>.+?)\\}', 'gu');
    const matches = incomingStr.matchAll(regexForProperlyFormedFVTTLinks);
    let linkMap = new Map();
    for (const match of matches){
        //console.log(match.groups.DocType);
        let matchedDoc = String(match.groups.DocType);
        switch(matchedDoc){
            case 'JournalEntry':
                //console.log(match[0]);
                //console.log(match.groups.DocID)
                //let obj = await game.journal.get(match.groups.DocID);
                //console.log(obj);
                if(await game.journal.get(match.groups.DocID)==null){
                    let jObjByName = await game.journal.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    if(jObjByName != undefined){
                        linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                    }
                };
                //console.log(linkMap);
                break;
            case 'Actor':
                if(await game.actors.get(match.groups.DocID)==null){
                    let jObjByName = await game.actors.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    if(jObjByName != undefined){
                        linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                    }
                };
                //console.log(linkMap);
                break;
            case 'Item':
                if(await game.items.get(match.groups.DocID)==null){
                    let jObjByName = await game.items.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    if(jObjByName != undefined){
                        linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                    }
                };
                //console.log(linkMap);
                break;
            case 'Scene':
                if(await game.scenes.get(match.groups.DocID)==null){
                    let jObjByName = await game.scenes.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    if(jObjByName != undefined){
                        linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                    }
                };
                break;
            case 'RollTable':
                if(await game.tables.get(match.groups.DocID)==null){
                    let jObjByName = await game.tables.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    if(jObjByName != undefined){
                        linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                    }
                };
                break;
            case 'Compendium':
                break;
            case 'UUID':
                break;
        }
        //console.log(linkMap);
        //console.log(match.groups.DocType);
        //console.log(match.groups.DocID);
        //console.log(match.groups.UserText);
        //console.log(match[0]);
    }
    ///iterate through map and then str replace all links with the appropriate ids
    let outgoingStr = incomingStr;
    linkMap.forEach((value,key) => {
        outgoingStr = outgoingStr.replaceAll(key,value);
    });
    //console.log(outgoingStr);
    return outgoingStr;
    }
    else{
        Logger.log(`Received: ${journalContent} at addjournalLinks`)
    }
    //console.log(outgoingStr);
    ///iterate through map and then str replace all links with the appropriate ids
}

//This function takes a HTML string and then will splice it out so that it can be put back together replacing links like @JournalEntry[A Cool Journal Entry] with @JournalEntry[A Cool Journal Entry]{A Cool Journal Entry}
function prepBadHTMLJournalLinks(dirtyJournalContent){
    const regexForFVTTLinksWithNoBrackets = new RegExp('@(.+?)\\[(?=((.+?)\\](?=([A-Za-z0-9_""\'/\\u201C])|\\{(.+?)\\})))', 'gu');
    let dirtyfile = dirtyJournalContent;
    let dflen = 0;
    if(dirtyfile != undefined){
        dflen = dirtyfile.length;

        let array = [...dirtyfile.matchAll(regexForFVTTLinksWithNoBrackets)];
        
        let newDirtyFile = '';
        let cursorPos = 0;
        for(const match of array){
            let doctype = String(match[1]);
            let linkinfoid = String(match[3]);
            let linktext = String(match[5]);
            let linkidx = match.index;
            let linklenShort = String(String(match[0])+String(match[2])).length; // this is the length only for @XXX[XXXXX] format links not @xxx[xxxx]{xxxxx}
            let linklenLong = linklenShort + linktext.length + 2;

            //append string content from last match
            newDirtyFile += dirtyfile.substr(cursorPos, (linkidx-cursorPos));
            //update cursor Pos to end of match
            if(linktext === 'undefined'){
                cursorPos = linkidx + linklenShort;
            }
            else{
                cursorPos = linkidx + linklenLong;
            }
            //adding the additional link information or putting back in a non failing link
            if (linktext === 'undefined'){
                newDirtyFile+="@"+doctype+"["+linkinfoid+"]"+"{"+linkinfoid+"}";
                console.log("Doctype: "+doctype+" Length: "+linklenShort + String(String(match[0])+String(match[2])) + "Link Text:" + linktext);
            }
            else {
                newDirtyFile+="@"+doctype+"["+linkinfoid+"]"+"{"+linktext+"}";
            }
            /*
            console.log(match[0]); 
            console.log(match[1]); // This is what comes after the @ in the link
            console.log(match[2]); // Need length of this to add back if we want to be able to get to correct index
            console.log(match[3]); //This is what is inside the [] of the link
            console.log(match[4]); //if this is undefined then this is a short form link like @JournalEntry[Journal Entry Name] we should take the Journal Entry Name and append inside {}
            console.log(match[5]); //This is what is inside the {} of the link
            console.log(match[6]);
            console.log(match.index);*/
        }
        if (cursorPos < dflen){
            newDirtyFile += dirtyfile.substr(cursorPos, (dflen - cursorPos))
        }
        //Logger.log(`Original Content Length: ${dirtyfile.length}`);
        //Logger.log(`Original Content Length: ${newDirtyFile.length}`)

        return newDirtyFile;
    }
    else {
        Logger.log(`Received this at prepHTML: ${dirtyfile}`)
        return dirtyfile;
    }
}

export async function journalV10prepALL(foldermap){
    let journalPageArray = [];
    game.journal.directory.documents.forEach(j => {
        //console.log(j);
        //let journalFolder = j.folder._id;
        let journalpath = '';
        if(j.folder != null){ //JournalEntries that are not in any subfolder will have a value of null, we will want to set the path to the top group folder
            journalpath = foldermap.get(j.folder._id);
            if(journalpath == undefined){journalpath = 'JournalEntry'}; //Just in case we can't find the folder (which shouldn't happen, throw the document into the top group folder)
        }
        else{
            journalpath = 'JournalEntry';
        }
        j.pages.forEach(p =>{
            let journalPageData = {
                jEntryID: j._id,
                docType: 'JournalEntryPage',
                unsafeJEName: j.name,
                unsafeJEPageName: p.name,
                jEntryName: makeStringSafe(j.name),
                folder: j.folder,
                pageID: p._id,
                type: p.type,
                name:  makeStringSafe(p.name),
                htmltext: prepBadHTMLJournalLinks(p.text.content),
                mdtext: p.text.markdown,
                markdown: '',
                format: p.text.format,
                folderPath: journalpath,
                imgpath: p.src
            }
            journalPageArray.push(journalPageData);
        });
    });
    Logger.log(`First pass Page Array: ${journalPageArray}`);
    for (let page of journalPageArray) {
        let cleanedString = await addJournalLinksIds(page.htmltext);
        page.htmltext = cleanedString;
    }
    Logger.log(`Second pass Page Arary: ${journalPageArray}`);
    return journalPageArray;
}

export async function journalV10prep(journal, foldermap, isCompendium){
    let j = journal;
    let journalpath ='';
    if(j.folder!=null && !isCompendium){ ///JournalEntries that are not in any subfolder will have a value of null, we will want to set the path to the top group folder
        journalpath = foldermap.get(j.folder._id);
        if(journalpath == undefined){journalpath = 'JournalEntry'} //Just in case we can't find the folder (which shouldn't happen, throw the document into the top group folder)
    }
    else{
        if(isCompendium){
            journalpath = 'Compendium'+'/'+j.pack.replace('.','/');
        }
        else{
            journalpath = 'JournalEntry';
        }
    }
    //console.log(journalent.folder._id)
    let journalPageArray = [];
    j.pages.forEach(p =>{
        let journalPageData = {
            jEntryID: j._id,
            docType: 'JournalEntryPage',
            unsafeJEName: j.name,
            unsafeJEPageName: p.name,
            jEntryName: makeStringSafe(j.name),
            folder: j.folder,
            pageID: p._id,
            type: p.type,
            name:  makeStringSafe(p.name),
            htmltext: prepBadHTMLJournalLinks(p.text.content),
            mdtext: p.text.markdown,
            markdown: '',
            format: p.text.format,
            folderPath: journalpath,
            imgpath: p.src
        }
        journalPageArray.push(journalPageData);
    })
    Logger.log(`First pass Page Array: ${journalPageArray}`);
    for (let page of journalPageArray) {
        let cleanedString = await addJournalLinksIds(page.htmltext);
        page.htmltext = cleanedString;
    }
    Logger.log(`Second pass Page Arary: ${journalPageArray}`);
    return journalPageArray;
}

export async function singleJournalPageV10prep(journalPage,foldermap,isCompendium){
    let journalpath = '';
    if(journalPage.parent.folder!=null && !isCompendium){ ///JournalEntries that are not in any subfolder will have a value of null, we will want to set the path to the top group folder
        journalpath = foldermap.get(journalPage.parent.folder._id);
        if(journalpath == undefined){journalpath = 'JournalEntry'} //Just in case we can't find the folder (which shouldn't happen, throw the document into the top group folder)
    }
    else{
        if(isCompendium){
            journalpath = 'Compendium'+'/'+journalPage.pack.replace('.','/');
        }
        else{
            journalpath = 'JournalEntry';
        }
    }
    let p = journalPage;
    let journalPageData = {
        jEntryID: p.parent._id,
        docType: 'JournalEntryPage',
        unsafeJEName: p.parent.name,
        unsafeJEPageName: p.name,
        jEntryName: makeStringSafe(p.parent.name),
        folder: p.parent.folder,
        pageID: p._id,
        type: p.type,
        name:  makeStringSafe(p.name),
        htmltext: prepBadHTMLJournalLinks(p.text.content),
        mdtext: p.text.markdown,
        markdown: '',
        format: p.text.format,
        folderPath: journalpath,
        imgpath: p.src
    }

    journalPageData.htmltext = await addJournalLinksIds(journalPageData.htmltext);

    return journalPageData;
}

export async function convertHTMLtoMD(cleanhtmlstring){
    let converter = new showdown.Converter({ tables: true, strikethrough: true } );
    let mdstring = converter.makeMarkdown(cleanhtmlstring);
    return mdstring;
}

export async function nonJournalHTMLPrep(dirtyContent){
    return await prepBadHTMLJournalLinks(dirtyContent);
}

export async function nonJournalLinkIDs(dirtyContent){
    return await addJournalLinksIds(dirtyContent);
}