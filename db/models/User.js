import { DataTypes } from "sequelize";

import sequelize from "../sequelize.js";

const User = sequelize.define(
    "user",
    {
        telegramId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            unique: true,
        },
        first_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        last_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        language_code: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "ru",
        },
        groupId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        groupTitle: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        country: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        city: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        scope: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        profession: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        employmentType: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        operatingMode: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        vaсancyFilterLink: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }
)

// User.sync({force: true});

export default User;