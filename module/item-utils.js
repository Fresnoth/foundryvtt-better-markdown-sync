import * as Logger from './logger.js';
import * as Constants from './constants.js';
import { makeStringSafe } from './folder-utils.js';
import { nonJournalHTMLPrep, convertFVTTJnlLinksToMDLinksRefactor, nonJournalLinkIDs, convertHTMLtoMD, addEmbeddedImageFromImgJournal, addYAMLFrontMatter} from './journal-utils.js'

export async function itemPrepBase(itemObj,foldermap,isCompendium){
    let itempath = '';
    if(itemObj.folder != null && !isCompendium){ //JournalEntries that are not in any subfolder will have a value of null, we will want to set the path to the top group folder
        itempath = foldermap.get(itemObj.folder._id);
        if(itempath == undefined){itempath = 'Item'}; //Just in case we can't find the folder (which shouldn't happen, throw the document into the top group folder)
    }
    else{
        if(isCompendium){
            itempath = 'Compendium'+'/'+itemObj.pack.replace('.','/');
        }
        else{
            itempath = 'Item';
        }
    }
    let gameSystem = ''
    if(itemObj._stats.systemId == null){
        gameSystem = game.world.system; // this is a fallback as not all compendium items have the systemID filled in for legacy FVTT
    }
    else{
        gameSystem = itemObj._stats.systemId;
    }
    let itemData = {
        _id: itemObj._id,
        docType: 'Item',
        name: makeStringSafe(itemObj.name),
        type: itemObj.type,
        imgpath: itemObj.img,
        system: gameSystem,
        folderPath: itempath
    }

    itemData.markdown = await addEmbeddedImageFromImgJournal(itemData);
    
    if(itemData.system == 'dnd5e'){
        itemData.descripton = await dnd5eItemDescToMD(itemObj,foldermap);
    }

    itemData.markdown += '\n' + itemData.descripton
    itemData.markdown = await addYAMLFrontMatter(itemData.markdown,itemData);
    return itemData;
    /*
    game.actors.forEach(a => {
    });*/
}

async function dnd5eItemDescToMD(itemObj,foldermap){
    let cleanedContent = ''
    console.log(itemObj);
    if(itemObj.system.description.value != undefined){
        cleanedContent = await nonJournalHTMLPrep(itemObj.system.description.value);
        cleanedContent = await nonJournalLinkIDs(cleanedContent);
        cleanedContent = await convertHTMLtoMD(cleanedContent);
        cleanedContent = await convertFVTTJnlLinksToMDLinksRefactor(cleanedContent,itemObj,foldermap);
        return cleanedContent;
    }
    else{
        return null;
    }
}