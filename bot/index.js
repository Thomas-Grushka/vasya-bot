import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from "toad-scheduler";
import * as cheerio from 'cheerio';
import jsdom from "jsdom";
import axios from "axios";

import * as groupsServices from "../services/groupsServices.js";
import * as vacancyServices from "../services/vacancyServices.js";
import * as usersServices from "../services/usersServices.js";

const { TELEGRAM_BOT_TOKEN: botToken, ZENROWS_API_KEY } = process.env;

const {JSDOM} = jsdom;

const scrapperInstance = axios.create({
    baseURL: `https://api.zenrows.com/v1/?apikey=${ZENROWS_API_KEY}`,
})

const getPageWithProxy = async url => {
    try {
        const {data} = await scrapperInstance.get("", {
            params: {
                url,
            }
        })
        return data;
    }
    catch(error) {
        console.log(error.message);
        throw error;
    }
}

const getDocument = data => {
    const dom = new JSDOM(data);
    const {document} = dom.window;

    return document;
}

const parseVacancy = (data, {groupId, resource}) => {
    const dom = getDocument(data);
    const schema = JSON.parse(dom.querySelector(`script[type="application/ld+json"]`).textContent);
    const link = schema.sameAs;
    const resourceId = schema.identifier.value;
    const {title, datePosted} = schema;
    const timePosted = dom.querySelector(`[data-marker="item-view/item-date"]`).textContent.split(" ").pop();
    const date = `${datePosted} ${timePosted}`;
    const salary = dom.querySelector(`[data-marker="item-view/item-price"]`).textContent;
    let description = `<b>Условия</b>\n`;
    const conditions = dom.querySelectorAll(".params-paramsList-_awNW .params-paramsList__item-_2Y2O");
    for(const condition of conditions) {
        description += `- ${condition.textContent}\n`;
    }
    description += "\n";

    description += "<b>Расположение</b>\n";
    const location = dom.querySelector(".style-item-address__string-wt61A").textContent;
    description += `${location}\n\n`;

    description += "<b>Описание</b>\n";
    const content = dom.querySelector(`[data-marker="item-view/item-description"]`).children;
    for(const item of content) {
        if(item.tagName === "P" && item.innerHTML === "<br>") {
            description += "\n\n";
        }
        if(item.tagName === "P" && item.innerHTML !== "<br>") {
            description += `${item.textContent}\n`;
        }
        if(item.tagName === "OL") {
            for(let i = 0; i < item.children.length; i++) {
                const text = item.children[i].textContent;
                description += `${i+1}. ${text}\n`;
            }
            description += "\n";
        }
        if(item.tagName === "UL") {
            for(let i = 0; i < item.children.length; i++) {
                const text = item.children[i].textContent;
                description += `- ${text}\n`;
            }
            description += "\n";
        }
    }

    const employer = schema.hiringOrganization.name;

    return {
        groupId,
        resource,
        link,
        resourceId,
        title,
        salary,
        description,
        employer,
        date,
        publishCount: 0,
    };
}

const createVacancyText = ({title, salary, description, employer, link})=> {
    const result = [];
    let text = `<b>${title}</b>\n\n`;
    text += `Зарплата: ${salary}\n\n`;
    if((title + salary + description + employer + link).length > 4000) {
        const firstDescriptionPart = description.slice(0, 2000);
        const index = firstDescriptionPart.lastIndexOf("\n");
        const firstDescription = description.slice(0, index);
        text += `${firstDescription}\n\n`;
        result.push(text);
        const secondDescription = description.slice(index);
        let secondText = `${secondDescription}\n\n`;
        secondText += `Работодатель: ${employer}\n\n`;
        secondText += `<a href="${link}">Ссылка на вакансию</a>`;
        result.push(secondText);
    } else {
        text += `${description}\n\n`;
        text += `Работодатель: ${employer}\n\n`;
        text += `<a href="${link}">Ссылка на вакансию</a>`;
        result.push(text);
    }

    return result;
}

// const createRetryableTask = (taskName, taskFunction, maxRetries = 3) => {
//     let retryCount = 0;
  
//     return new AsyncTask(
//       taskName,
//       async () => {
//         try {
//           await taskFunction();
//           // Сброс счетчика при успешном выполнении
//           retryCount = 0;
//         } catch (error) {
//           console.error(`Ошибка в задаче ${taskName}:`, error);
//           retryCount += 1;
//           if (retryCount <= maxRetries) {
//             console.log(`Попытка повторить задачу ${taskName}, попытка ${retryCount}/${maxRetries}`);
//             // Повторный вызов самой задачи
//             await new Promise((resolve) => setTimeout(resolve, 1000)); // Пауза перед повтором
//             throw new Error('Повтор запуска задачи');
//           } else {
//             console.error(`Превышено количество попыток для задачи ${taskName}`);
//             retryCount = 0; // Сброс счетчика, если превышен лимит
//           }
//         }
//       }
//     );
//   };

const retryAsyncFunction = async (asyncFunction, maxRetries = 3, delay = 1000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // Попытка выполнения асинхронной функции
        return await asyncFunction();
      } catch (error) {
        attempt += 1;
        console.error(`Ошибка: ${error.message}. Попытка ${attempt} из ${maxRetries}`);
        if (attempt >= maxRetries) {
          throw new Error(`Функция завершилась с ошибкой после ${maxRetries} попыток`);
        }
        // Задержка перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

export const startBot = () => {
    const bot = new Telegraf(botToken);

    const scheduler = new ToadScheduler();

    bot.on(message('new_chat_members'), async (ctx) => {
        try {
            const {id: groupId, title: groupTitle} = ctx.chat;
            const {new_chat_member} = ctx.message;
            const {id: telegramId, ...userData } = new_chat_member;
            const user = await usersServices.findUser({telegramId});
            if(!user) {
                await usersServices.addUser({...userData, telegramId, groupId, groupTitle});
                console.log("new member joined");
            }
        }
        catch(error) {
            console.log(error.message);
        }
    });

    bot.command("run", async ctx => {
        console.log("Start bot");

        const vacancySendTask = new AsyncTask(
            "send vacancy",
            async () => {
                const groups = await groupsServices.getAllActiveGroups();
                for(const {id, groupId, link} of groups) {
                    const sendVacancy = async()=> {
                        const allVacanciesPage = await getPageWithProxy(link);
                        const allVacancies = await vacancyServices.getVacanciesResourceIds({groupId: id});
                        const allVacanciesResourceIds = allVacancies.map(({resourceId}) => resourceId);

                        const $ = cheerio.load(allVacanciesPage);
                        
                        const newVacancyItem = [...$("[data-marker=item]")].find(item => !allVacanciesResourceIds.includes($(item).attr("data-item-id")));
                        if(newVacancyItem) {
                            const vacancyPath = $(newVacancyItem).find("[data-marker=item-title]").attr("href");
                            const vacancyUrl = `https://www.avito.ru${vacancyPath}`;
                            const vacancyPage = await getPageWithProxy(vacancyUrl);
                            const data = parseVacancy(vacancyPage, {resource: "avito", groupId: id});
                            await vacancyServices.addVacancy(data);
                            const text = createVacancyText(data);
                            console.log("groupId", groupId);
                            await ctx.telegram.sendMessage(groupId, text[0], { parse_mode: 'HTML' });
                            if(text[1]) {
                                bot.telegram.sendMessage(groupId, text[1], { parse_mode: 'HTML' });
                                // await ctx.telegram.sendMessage(channel, text[1], { parse_mode: 'HTML' });
                            }
                            console.log("send");
                        }
                    };
                    await retryAsyncFunction(sendVacancy, 5, 2000);
                }
            },
            (error) => {
                console.log(error.message);
            }
        );

        // const groups = await groupsServices.getAllActiveGroups();

        // const taskList = groups.map(({id, groupId, link})=> {
        //     return async ()=> {
        //         const allVacanciesPage = await getPageWithProxy(link);
        //         const allVacancies = await vacancyServices.getVacanciesResourceIds({groupId: id});
        //         const allVacanciesResourceIds = allVacancies.map(({resourceId}) => resourceId);

        //         const $ = cheerio.load(allVacanciesPage);
                
        //         const newVacancyItem = [...$("[data-marker=item]")].find(item => !allVacanciesResourceIds.includes($(item).attr("data-item-id")));
        //         if(newVacancyItem) {
        //             const vacancyPath = $(newVacancyItem).find("[data-marker=item-title]").attr("href");
        //             const vacancyUrl = `https://www.avito.ru${vacancyPath}`;
        //             const vacancyPage = await getPageWithProxy(vacancyUrl);
        //             const data = parseVacancy(vacancyPage, {resource: "avito", groupId: id});
        //             await vacancyServices.addVacancy(data);
        //             const text = createVacancyText(data);
        //             console.log("groupId", groupId);
        //             await ctx.telegram.sendMessage(groupId, text[0], { parse_mode: 'HTML' });
        //             if(text[1]) {
        //                 bot.telegram.sendMessage(groupId, text[1], { parse_mode: 'HTML' });
        //                 // await ctx.telegram.sendMessage(channel, text[1], { parse_mode: 'HTML' });
        //             }
        //             console.log("send");
        //         }
        //     }
        // })

        // const retryableTaskList = taskList.map(task => createRetryableTask('Vacancy Send Task', task));

        // const vacancySend = async () => {
        //     const groups = await groupsServices.getAllActiveGroups();
        //     for(const {id, groupId, link} of groups) {
        //         const allVacanciesPage = await getPageWithProxy(link);
        //         const allVacancies = await vacancyServices.getVacanciesResourceIds({groupId: id});
        //         const allVacanciesResourceIds = allVacancies.map(({resourceId}) => resourceId);

        //         const $ = cheerio.load(allVacanciesPage);
                
        //         const newVacancyItem = [...$("[data-marker=item]")].find(item => !allVacanciesResourceIds.includes($(item).attr("data-item-id")));
        //         if(newVacancyItem) {
        //             const vacancyPath = $(newVacancyItem).find("[data-marker=item-title]").attr("href");
        //             const vacancyUrl = `https://www.avito.ru${vacancyPath}`;
        //             const vacancyPage = await getPageWithProxy(vacancyUrl);
        //             const data = parseVacancy(vacancyPage, {resource: "avito", groupId: id});
        //             await vacancyServices.addVacancy(data);
        //             const text = createVacancyText(data);
        //             console.log("groupId", groupId);
        //             await ctx.telegram.sendMessage(groupId, text[0], { parse_mode: 'HTML' });
        //             if(text[1]) {
        //                 bot.telegram.sendMessage(groupId, text[1], { parse_mode: 'HTML' });
        //                 // await ctx.telegram.sendMessage(channel, text[1], { parse_mode: 'HTML' });
        //             }
        //             console.log("send");
        //         }
        //     }
        // }

        // const retryableVacancySendTask = createRetryableTask('Vacancy Send Task', vacancySend);
        // const vacancySendTask = new AsyncTask(
        //     "send vacancy",
        //     async () => {
        //         const groups = await groupsServices.getAllActiveGroups();
        //         for(const {id, groupId, link} of groups) {
        //             const allVacanciesPage = await getPageWithProxy(link);
        //             const allVacancies = await vacancyServices.getVacanciesResourceIds({groupId: id});
        //             const allVacanciesResourceIds = allVacancies.map(({resourceId}) => resourceId);

        //             const $ = cheerio.load(allVacanciesPage);
                    
        //             const newVacancyItem = [...$("[data-marker=item]")].find(item => !allVacanciesResourceIds.includes($(item).attr("data-item-id")));
        //             if(newVacancyItem) {
        //                 const vacancyPath = $(newVacancyItem).find("[data-marker=item-title]").attr("href");
        //                 const vacancyUrl = `https://www.avito.ru${vacancyPath}`;
        //                 const vacancyPage = await getPageWithProxy(vacancyUrl);
        //                 const data = parseVacancy(vacancyPage, {resource: "avito", groupId: id});
        //                 await vacancyServices.addVacancy(data);
        //                 const text = createVacancyText(data);
        //                 console.log("groupId", groupId);
        //                 await ctx.telegram.sendMessage(groupId, text[0], { parse_mode: 'HTML' });
        //                 if(text[1]) {
        //                     bot.telegram.sendMessage(groupId, text[1], { parse_mode: 'HTML' });
        //                     // await ctx.telegram.sendMessage(channel, text[1], { parse_mode: 'HTML' });
        //                 }
        //                 console.log("send");
        //             }
        //         }
        //     },
        //     (error) => {
        //         console.log(error.message);
        //     }
        // );

        const botLinkMessageTask = new AsyncTask(
            "send bot link message",
            async () => {
                const groups = await groupsServices.getAllActiveGroups();
                for(const {groupId} of groups) {
                    await bot.telegram.sendMessage(groupId, "Жора предложит более точный поиск", {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.url("Перейти на Жору", "https://t.me/ZhoraHelpBot"),
                                ]
                            ],
                        }
                    });
                }
            },
            (error) => {
                console.log(error.message);
            }
        );

        // const jobs = retryableTaskList.map((task) => {
        //     return new SimpleIntervalJob({ seconds: 30 }, task);
        //   });

        const vacancyJob = new SimpleIntervalJob({
            // minutes: 30,
            seconds: 30,
        }, vacancySendTask);

        const linkMessageJob = new SimpleIntervalJob({
            // minutes: 155,
            seconds: 50,
        }, botLinkMessageTask)

        // jobs.forEach(job => scheduler.addSimpleIntervalJob(job));

        scheduler.addSimpleIntervalJob(vacancyJob);
        scheduler.addSimpleIntervalJob(linkMessageJob);
    });

    bot.command("stop", () => {
        console.log("Stop bot");
        scheduler.stop();
    })

    bot.launch();
}


