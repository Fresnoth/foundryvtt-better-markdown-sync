import * as Logger from './logger.js';
import * as Constants from './constants.js';
import { makeStringSafe } from './folder-utils.js';
import { nonJournalHTMLPrep, convertFVTTJnlLinksToMDLinksRefactor, nonJournalLinkIDs, convertHTMLtoMD, addEmbeddedImageFromImgJournal, addYAMLFrontMatter} from './journal-utils.js'

export async function actorPrepBase(actorObj,foldermap,isCompendium){
    let actObj = [];
    let actpath = '';
    if(actorObj.folder != null && !isCompendium){ //JournalEntries that are not in any subfolder will have a value of null, we will want to set the path to the top group folder
        actpath = foldermap.get(actorObj.folder._id);
        if(actpath == undefined){actpath = 'Actor'}; //Just in case we can't find the folder (which shouldn't happen, throw the document into the top group folder)
    }
    else{
        if(isCompendium){
          actpath = 'Compendium'+'/'+actorObj.pack.replace('.','/');
        }
        else{
        actpath = 'Actor';
        }
    }
    let actorData = {
        _id: actorObj._id,
        docType: 'Actor',
        name: makeStringSafe(actorObj.name),
        type: actorObj.type,
        imgpath: actorObj.img,
        system: actorObj._stats.systemId,
        folderPath: actpath
    }

    actorData.markdown = await addEmbeddedImageFromImgJournal(actorData);
    
    if(actorData.system == 'dnd5e'){
        actorData.biography = await dnd5eActorBioToMD(actorObj,foldermap);
    }

    actorData.markdown += '\n' + actorData.biography
    actorData.markdown = await addYAMLFrontMatter(actorData.markdown,actorData);
    return actorData;
    /*
    game.actors.forEach(a => {
    });*/
}

async function dnd5eActorBioToMD(actorObj,foldermap){
    let cleanedContent = ''
    Logger.logTrace(actorObj);
    if(actorObj.system.details.biography.value != undefined){
        cleanedContent = await nonJournalHTMLPrep(actorObj.system.details.biography.value);
        cleanedContent = await nonJournalLinkIDs(cleanedContent);
        cleanedContent = await convertHTMLtoMD(cleanedContent);
        cleanedContent = await convertFVTTJnlLinksToMDLinksRefactor(cleanedContent,actorObj,foldermap); 
        return cleanedContent;
    }
    else{
        return null;
    }
}

async function dnd5eActorObsidianStatBlock(actorObj){

}
/*
```statblock
image: [[Wikilink To Image]]
name: string
size: string
type: string
subtype: string
alignment: string
ac: number
hp: number
hit_dice: string
speed: string
stats: [number, number, number, number, number, number]
fage_stats: [number, number, number, number, number, number, number, number, number]
saves:
  - <ability-score>: number
skillsaves:
  - <skill-name>: number
damage_vulnerabilities: string
damage_resistances: string
damage_immunities: string
condition_immunities: string
senses: string
languages: string
cr: number
spells:
  - <description>
  - <spell level>: <spell-list>
traits:
  - name: <trait-name>
    desc: <trait-description>
  - ...
actions:
  - name: <trait-name>
    desc: <trait-description>
  - ...
legendary_actions:
  - name: <legendary_actions-name>
    desc: <legendary_actions-description>
  - ...
bonus_actions:
  - name: <trait-name>
    desc: <trait-description>
  - ...
reactions:
  - name: <reaction-name>
    desc: <reaction-description>
  - ...
```
*/