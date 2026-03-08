import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import path from 'path';

import {StorageHelpers} from "./Helpers";
import {App} from "./Constants";
import FuzzySearch from "./FuzzySearch";

class Api {
    static _instance = null;

    static getInstance() {
        if (!Api._instance) {
            Api._instance = new Api();
        }
        return Api._instance;
    }

    static resetInstance() {
        Api._instance = null;
    }

    constructor() {
        const dbFilePath = path.join(StorageHelpers.preference.get('storagePath'), App.dbName);
        const adapter = new FileSync(dbFilePath);
        this.db = lowdb(adapter);
        this.db.defaults({commands: []}).write();
    }

    reload() {
        this.db.read();
    }

    addNewCommandItem = item => this.db.get('commands').push(item).write();

    updateCommandItem = obj => this.db.get('commands').find({id: obj.id}).assign(obj).write();

    deleteCommandById = id => this.db.get('commands').remove({id}).write();

    getCommandById = id => this.db.get('commands').find({id}).value();

    getAllCommands = () => this.db.get('commands').filter({isTrash: false}).value();

    getAllCommandsInTrash = () => this.db.get('commands').filter({isTrash: true}).value();

    getAllUntaggedCommands = () => this.db.get('commands').filter(t => (!t.tags || t.tags === "") && t.isTrash === false).value();

    getAllFavouriteCommands = () => this.db.get('commands').filter({isFavourite: true, isTrash: false}).value();

    getAllTags = () => this.db.get('commands').filter({isTrash: false}).map('tags').value();

    getCommandsContainsTag = tag => this.db.get('commands').filter(t => t.tags && t.tags.indexOf(tag) > -1 && t.isTrash === false).value();

    queryCommand = query => {
        const allActive = this.db.get('commands').filter({isTrash: false}).value();
        const fuzzy = new FuzzySearch({
            keys: [
                {name: 'title', weight: 3},
                {name: 'command', weight: 2},
                {name: 'tags', weight: 1},
                {name: 'description', weight: 0.5}
            ]
        });
        const usageBoostFn = item => Math.min(Math.log2((item.usageCount || 0) + 1) * 5, 25);

        // #tag prefix search
        const tagMatch = query.match(/^#(\S+)\s*(.*)/);
        if (tagMatch) {
            const tag = tagMatch[1].toLowerCase();
            const searchQuery = tagMatch[2].trim();

            // Filter by exact tag match (case-insensitive)
            const filtered = allActive.filter(cmd =>
                cmd.tags && cmd.tags.split(',').some(t => t.trim().toLowerCase() === tag)
            );

            if (searchQuery) {
                return fuzzy.search(filtered, searchQuery, usageBoostFn).map(r => r.item);
            }

            // No search query: return all matching, sorted by usage
            return filtered.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        }

        return fuzzy.search(allActive, query, usageBoostFn).map(r => r.item);
    };

    incrementUsage = id => {
        const command = this.db.get('commands').find({id});
        const current = command.value();
        if (current) {
            command.assign({
                usageCount: (current.usageCount || 0) + 1,
                lastUsedAt: new Date().toISOString()
            }).write();
        }
    };
}

export default Api;