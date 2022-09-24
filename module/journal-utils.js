import * as Logger from './logger.js';

let linkMap = new Map();


export async function prepJournalsExport(){
    /*
    game.journal.forEach(jentry => {
        console.log(jentry.folder._id)
    });*/
    cleanJounalObj = [];


}

//This function will take an incoming text string and search for badly formed FVTT links in the format @JournalEntry[SOME TEXT HERE]{Something}
//The conversion will go thought and put the appropriate FVTT Document ID in for the text between the brackets @JournalEntry[DocumentID]{Something}
//This function should be proceeded by running the content through the prepBadHTMLLinks
//if this is run out of order the regex may destroy significant portions of the document or just break
async function addJournalLinksIds(journalContent){
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
                    linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                };
                //console.log(linkMap);
                break;
            case 'Actor':
                if(await game.actors.get(match.groups.DocID)==null){
                    let jObjByName = await game.actors.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                };
                //console.log(linkMap);
                break;
            case 'Item':
                if(await game.items.get(match.groups.DocID)==null){
                    let jObjByName = await game.items.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                };
                //console.log(linkMap);
                break;
            case 'Scene':
                if(await game.scenes.get(match.groups.DocID)==null){
                    let jObjByName = await game.scenes.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                };
                break;
            case 'RollTable':
                if(await game.tables.get(match.groups.DocID)==null){
                    let jObjByName = await game.tables.getName(match.groups.DocID);
                    //console.log(jObjByName);
                    linkMap.set(match[0],'@'+match.groups.DocType+'['+jObjByName._id+']{'+match.groups.UserText+'}');
                };
                break;
            case 'Compendium':
                break;
            case 'UUID':
                break;
        }
        console.log(linkMap);
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
    //console.log(outgoingStr);
    ///iterate through map and then str replace all links with the appropriate ids
}

//This function takes a HTML string and then will splice it out so that it can be put back together replacing links like @JournalEntry[A Cool Journal Entry] with @JournalEntry[A Cool Journal Entry]{A Cool Journal Entry}
function prepBadHTMLJournalLinks(dirtyJournalContent){
    const regexForFVTTLinksWithNoBrackets = new RegExp('@(.+?)\\[(?=((.+?)\\](?=([A-Za-z0-9_""\'/\\u201C])|\\{(.+?)\\})))', 'gu');
    let dirtyfile = dirtyJournalContent;
    let dflen = dirtyfile.length;
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


let journalent = await game.journal.get('jusKa3qmhyxf2sd5');
journalPageArray = [];
journalent.pages.forEach(p =>{
    let journalData = {
        jEntryID: journalent._id,
        folder: journalent.folder,
        pageID: p._id,
        name:  p.name,
        type: p.type,
        htmltext: prepBadHTMLJournalLinks(p.text.content),
        mdtext: p.text.markdown,
        format: p.text.format
    }
    journalPageArray.push(journalData);
});

let cleanedString = await addJournalLinksIds(journalPageArray[0].htmltext);
console.log(cleanedString);
