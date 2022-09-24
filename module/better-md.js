
export default class BMDSync extends Application {
    static get defaultOptions(){
        const options = super.defaultOptions;
        options.id = "bmd-sync";
        options.template = "modules/better-markdown-sync/html/bmd-sync.hbs"
        options.classes.push("bmd-sync");
        options.resizable = false;
        options.height = "auto";
        options.width = 600;
        options.minimizable = false;
        options.title = "Better Markdown Sync";
        return options;
    }

    getData() {
        let data = super.getData();
        data.folders = game.journal.directory.folders;
        data.journals = game.journal.directory.documents;

        //let settings = game.settings.get("bmd-sync", "exportSettings")
        return data;
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        html.find("#import-selected").click(async () => {
            ui.notifications.info("Importing");
        });
        html.find("#export-selected").click(async () => {
            console.log("That Export Button");
        });
    }
}