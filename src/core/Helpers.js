import shortid from 'shortid';
import Noty from "noty";
import {platform, homedir} from 'os';
import Store from 'electron-store';
import Api from "./Api";
import {SET_SELECTED_MENU_ITEM, SET_TAGS} from "../redux/actions/sidebarActions";
import {SET_COMMAND_LIST} from "../redux/actions/commandActions";

import "noty/src/noty.scss";
import "noty/src/themes/sunset.scss";
import {App} from "./Constants";
import fs from "fs";
import path from "path";
import {escapeHtml} from "./Utils";

const pad = (n, len = 2) => String(n).padStart(len, '0');
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatDateForBackup = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

const parseDateFromBackup = (str) => {
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
};

const formatDateForDisplay = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const isWin = platform() === 'win32';
const defaultPath = isWin ? `${homedir()}\\${App.folderName}` : `${homedir()}/${App.folderName}`;
const backupPath = isWin ? `${defaultPath}\\${App.backupFolderName}` : `${defaultPath}/${App.backupFolderName}`;
const storagePrefences = new Store({
    name: 'preferences',
    schema: {
        storagePath: {
            default: defaultPath
        },
        backupPath: {
            default: backupPath
        },
        globalHotkey: {
            type: 'string',
            default: 'Alt+C'
        },
        autoCloseAfterCopy: {
            type: 'boolean',
            default: true
        },
        autoPaste: {
            type: 'boolean',
            default: true
        },
        quickAddHotkey: {
            type: 'string',
            default: 'Alt+Z'
        },
        recentCount: {
            type: 'number',
            default: 10
        },
        panelPosition: {
            type: 'string',
            default: 'center'
        }
    }
})


const CommandHelpers = {
    organizeCommands: text => {
        const result = [];
        const matchedItems = text.match(new RegExp(`\\[s\\s*(.*?)\\s*\\/]`, 'g'));

        (matchedItems || []).forEach((val) => {
            let type = 'variable';

            if (val.indexOf('sc_choice') > -1) {
                type = 'choice';
            } else if (val.indexOf('sc_password') > -1) {
                type = 'password';
            }

            const nameMatch = val.match(/name="(.*?)"/);
            const valueMatch = val.match(val.indexOf('sc_password') > -1 ? /length="(.*?)"/ : /value="(.*?)"/);

            if (!nameMatch) return;

            result.push({
                id: shortid.generate(),
                type,
                name: nameMatch[1],
                value: valueMatch ? valueMatch[1] : ''
            });
        });

        return result;
    },

    replacedCommand: (text, paramsAsObj) => {
        const params = Object.values(paramsAsObj);
        const matchedItems = text.match(new RegExp(`\\[s\\s*(.*?)\\s*\\/]`, 'g'));

        (matchedItems || []).forEach((val, index) => {
            text = text.replace(val, params[index]);
        });

        return text;
    },

    commandAsHtml: text => {
        if (!text) return '';
        const matchedItems = text.match(new RegExp(`\\[s\\s*(.*?)\\s*\\/]`, 'g'));
        let escaped = escapeHtml(text);

        (matchedItems || []).forEach((val) => {
            const nameMatch = val.match(/name="(.*?)"/);
            if (!nameMatch) return;
            const escapedVal = escapeHtml(val);
            escaped = escaped.replace(escapedVal, `<span>&#60;${escapeHtml(nameMatch[1])}&#62;</span>`);
        });

        return escaped;
    },

    getCommands: (selectedMenu, query) => {
        let result = [];
        if (selectedMenu) {
            const slug = selectedMenu.slug;

            if (selectedMenu.type === 'menu') {
                if (slug === 'all_commands') {
                    result = Api.getInstance().getAllCommands();
                } else if (slug === 'favourites') {
                    result = Api.getInstance().getAllFavouriteCommands();
                } else if (slug === 'untagged') {
                    result = Api.getInstance().getAllUntaggedCommands();
                } else if (slug === 'trash') {
                    result = Api.getInstance().getAllCommandsInTrash();
                }
            } else if (selectedMenu.type === 'search') {
                result = query ? Api.getInstance().queryCommand(query.toLowerCase()) : [];
            } else {
                result = Api.getInstance().getCommandsContainsTag(slug);
            }
        }

        return result;
    }
}

const TagHelpers = {
    getAllItems: () => {
        let tagsAsStr = "";

        Api.getInstance().getAllTags().forEach(key => {
            if (key !== null && key !== "" && key !== undefined) tagsAsStr += `${key},`;
        });

        if (tagsAsStr === "") return [];

        tagsAsStr = tagsAsStr.substring(0, tagsAsStr.length - 1);
        return [...new Set(tagsAsStr.split(','))].sort();
    }
}

const ReduxHelpers = {
    fillTags: dispatch => dispatch({
        type: SET_TAGS,
        payload: TagHelpers.getAllItems()
    }),

    fillCommands: (dispatch, selectedMenu, query) => dispatch({
        type: SET_COMMAND_LIST,
        payload: CommandHelpers.getCommands(selectedMenu, query).map(item => ({...item}))
    }),

    setSelectedMenu: (dispatch, selectedMenu) => dispatch({
        type: SET_SELECTED_MENU_ITEM,
        payload: selectedMenu
    })
}

const NotyHelpers = {
    open: (text, type, timeout) => {
        new Noty({
            text,
            theme: 'sunset',
            layout: 'bottomRight',
            type,
            progressBar: false,
            timeout
        }).show();
    },
    closeAll: () => {
        new Noty().close();
    }
}

const StorageHelpers = {
    preference: storagePrefences,

    initDb: () => {
        try {
            const appDir = storagePrefences.get('storagePath').toString();
            const backupsDir = storagePrefences.get('backupPath').toString();

            if (!fs.existsSync(appDir)) {
                fs.mkdirSync(appDir, {recursive: true});
                fs.appendFileSync(path.join(appDir, App.dbName), "");
            }

            if (!fs.existsSync(backupsDir)) {
                fs.mkdirSync(backupsDir, {recursive: true});
            }
        } catch (err) {
            console.error('Failed to initialize database directory:', err);
        }
    },

    moveDb: (willMoveDir) => {
        try {
            const dbFileExistPath = path.join(storagePrefences.get('storagePath').toString(), App.dbName);
            const dbFileNewPath = path.join(willMoveDir, App.dbName);

            if (!fs.existsSync(willMoveDir)) {
                fs.mkdirSync(willMoveDir, {recursive: true});
            }

            fs.renameSync(dbFileExistPath, dbFileNewPath);
            storagePrefences.set('storagePath', willMoveDir);
            Api.resetInstance();
        } catch (err) {
            console.error('Failed to move database:', err);
            NotyHelpers.open('Failed to move database: ' + err.message, 'error', 3000);
        }
    },

    restoreDb: (willRestoreFilePath) => {
        try {
            const appDir = storagePrefences.get('storagePath').toString();

            if (!fs.existsSync(appDir)) {
                fs.mkdirSync(appDir, {recursive: true});
            }

            fs.copyFileSync(willRestoreFilePath, path.join(appDir, App.dbName));
        } catch (err) {
            console.error('Failed to restore database:', err);
            NotyHelpers.open('Failed to restore database: ' + err.message, 'error', 3000);
        }
    },

    autoBackup: () => {
        try {
            const backupFiles = StorageHelpers.backupFiles();

            if (backupFiles.length === 0) {
                StorageHelpers.backupNow();
            } else {
                const lastBackupTime = new Date(backupFiles[0].date).getTime() + 6 * 60 * 60 * 1000;

                if (Date.now() > lastBackupTime) {
                    StorageHelpers.backupNow();
                }
            }
        } catch (err) {
            console.error('Auto backup failed:', err);
        }
    },

    backupNow: () => {
        try {
            const dbFilePath = path.join(storagePrefences.get('storagePath').toString(), App.dbName);
            const dbBackupDir = path.join(storagePrefences.get('backupPath').toString(), formatDateForBackup(new Date()));

            if (!fs.existsSync(dbBackupDir)) {
                fs.mkdirSync(dbBackupDir, {recursive: true});
            }

            fs.copyFileSync(dbFilePath, path.join(dbBackupDir, App.dbName));
        } catch (err) {
            console.error('Backup failed:', err);
            NotyHelpers.open('Backup failed: ' + err.message, 'error', 3000);
        }
    },

    backupFiles: () => {
        const result = [];
        try {
            const backupDir = storagePrefences.get('backupPath').toString();

            if (!fs.existsSync(backupDir)) return result;

            const folders = fs.readdirSync(backupDir);

            folders.forEach((value) => {
                const parsed = parseDateFromBackup(value);
                if (!parsed) return;
                result.push({
                    name: formatDateForDisplay(parsed),
                    filePath: path.join(backupDir, value, App.dbName),
                    date: parsed.toISOString()
                })
            });

            result.reverse();
        } catch (err) {
            console.error('Failed to list backup files:', err);
        }
        return result;
    }
}

export {CommandHelpers, TagHelpers, ReduxHelpers, NotyHelpers, StorageHelpers};
