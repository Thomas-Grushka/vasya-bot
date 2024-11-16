import "dotenv/config";

import sequelize from "./db/sequelize.js";

import {startBot} from "./bot/index.js";

try {
    await sequelize.authenticate();
    console.log("Success connect to database");
    startBot();
}
catch(error) {
    console.log(error);
}



