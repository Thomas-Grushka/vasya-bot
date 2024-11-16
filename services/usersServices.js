import User from "../db/models/User.js";

export const addUser = payload => User.create(payload);

export const findUser = query => User.findOne({
    where: query,
});