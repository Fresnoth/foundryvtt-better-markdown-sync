// Import TypeScript modules
import * as Constants from './module/constants.js';
import * as Logger from './module/logger.js'
import { registerSettings } from './module/settings.js';
import * as JournalSync from './module/journal-sync.js'
import BMDSync from './module/better-md.js';

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
    Logger.log(`Initializing ${Constants.MODULE_NAME}`);
    Logger.log("    ___                       _    __,               ");
    Logger.log("   ( /                       //   (                  ");
    Logger.log("    / __ , , _   _ _   __,  //     `.  __  , _ _   _,");
    Logger.log("  _/_(_)(_/_/ (_/ / /_(_/(_(/_---(___)/ (_/_/ / /_(__");
    Logger.log(" //                                      /           ");
    Logger.log("(/                                      '            ");
    
    // Assign custom classes and constants here

    // Register custom module settings
    await registerSettings();

    // // Preload Handlebars templates
    // await preloadTemplates();

    await JournalSync.initModule();
    // Register custom sheets (if any)
});

/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', async function () {
    // Do anything after initialization but before
    // ready
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', async function () {
    // Do anything once the module is ready
    await JournalSync.readyModule();
});

// Add any additional hooks if necessary
Hooks.on("renderSidebarTab", async (app, html) =>{ 
    Logger.log("sidebar was rendered");
    if (app.options.id == "journal" && game.user.isGM) {
    let button = $("<div class='header-actions action-buttons flexrow'><button><i class='fas fa-user-robot'></i> Better Markdown Sync</button></div>");

    button.click(function() {
        new BMDSync().render(true);
       // const db = new DatabaseBakend();
       // db.getDocuments('JounalEntry')
    })
    /*
    button.click(async () => {
     console.log("the button was clicked");
      ui.notifications.info("Checking your DDB details - this might take a few seconds!");
      const setupComplete = isSetupComplete();
      if (setupComplete) {
        const cobaltStatus = await checkCobalt();
        if (cobaltStatus.success) {
          let validKey = await isValidKey();
          if (validKey) {
            new DDBMuncher().render(true);
          }
        } else {
          new DDBCookie().render(true);
        }
      } else {
        game.settings.set("ddb-importer", "settings-call-muncher", true);
        new DDBSetup().render(true);
      }
    });
    */
    $(html).find(".directory-header").append(button);
   //would potentially require reload from setting, not worrying about this now
    /*const top = game.settings.get(Constants.MODULE_NAME, "ShowButtonTop");
    if (top) {
      $(html).find(".directory-header").append(button);
    } else {
      $(html).find(".directory-footer").append(button);
    }*/
  }
});

