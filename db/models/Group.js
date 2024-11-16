import { DataTypes } from "sequelize";

import sequelize from "../sequelize.js";

const Group = sequelize.define(
    "group",
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        groupId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        }
    }
);

// Group.sync({force: true});

export default Group;