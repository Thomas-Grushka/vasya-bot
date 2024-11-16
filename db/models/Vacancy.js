import { DataTypes } from "sequelize";

import sequelize from "../sequelize.js";

const Vacancy = sequelize.define(
    "vacancy",
    {
        groupId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        resource: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        resourceId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        salary: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        employer: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        date: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        publishCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        }
    }
);

// Vacancy.sync({force: true});

export default Vacancy;