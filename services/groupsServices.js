import Group from "../db/models/Group.js";

export const getAllActiveGroups = ()=> Group.findAll({
    where: {
        active: true
    }
});

export const getGroupById = id => Group.findByPk(id);

export const addGroup = (data) => Group.create(data);

export const updateGroupById = async (id, data)=> {
    const group = await getGroupById(id);
    if(!group) {
        return null;
    }

    return group.update(data, {
        returning: true,
    });
}