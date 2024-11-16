import Vacancy from "../db/models/Vacancy.js";

export const getVacanciesResourceIds = query => Vacancy.findAll({
    where: query,
    attributes: ['resourceId']
})

export const addVacancy = data => Vacancy.create(data);
