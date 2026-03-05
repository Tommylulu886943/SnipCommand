import React, {Component} from 'react';
import {clipboard, ipcRenderer} from 'electron';
import shortid from 'shortid';

import Api from '../../core/Api';
import FuzzySearch from '../../core/FuzzySearch';
import {StorageHelpers, CommandHelpers} from '../../core/Helpers';
import {Keys} from '../../core/Constants';

import '../common.scss';
import './style.scss';


class QuickSearchPanel extends Component {
    constructor(props) {
        super(props);
        this.setTheme();
        StorageHelpers.initDb();

        this.fuzzySearch = new FuzzySearch({
            keys: [
                {name: 'title', weight: 3},
                {name: 'command', weight: 2},
                {name: 'tags', weight: 1},
                {name: 'description', weight: 0.5}
            ]
        });

        this.state = {
            query: '',
            results: [],
            selectedIndex: 0,
            showQuickSave: false,
            quickSaveForm: {title: '', command: '', tags: ''},
            paramForm: null,
            paramValues: {}
        };
    }

    componentDidMount() {
        if (this.searchInput) this.searchInput.focus();

        this._shownHandler = () => {
            this.setState({
                query: '',
                results: [],
                selectedIndex: 0,
                showQuickSave: false,
                paramForm: null
            }, () => this.loadRecent());

            if (this.searchInput) {
                this.searchInput.value = '';
                this.searchInput.focus();
            }
        };

        ipcRenderer.on('search-panel-shown', this._shownHandler);
        this.loadRecent();
    }

    componentWillUnmount() {
        ipcRenderer.removeListener('search-panel-shown', this._shownHandler);
    }

    setTheme = () => {
        const theme = `${StorageHelpers.preference.get('appTheme') || 'light'}-theme`;
        if (!document.body.classList.contains(theme)) document.body.classList.add(theme);
    }

    loadRecent = () => {
        try {
            const api = Api.getInstance();
            const all = api.getAllCommands();
            const recent = all
                .filter(c => c.lastUsedAt)
                .sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || ''))
                .slice(0, 10);
            this.setState({results: recent.length > 0 ? recent : all.slice(0, 10)});
        } catch (e) {
            this.setState({results: []});
        }
    }

    onSearchChange = (e) => {
        const query = e.target.value;
        this.setState({query, selectedIndex: 0}, () => {
            this.performSearch(query);
        });
    }

    performSearch = (query) => {
        if (!query || query.trim() === '') {
            this.loadRecent();
            return;
        }

        try {
            const api = Api.getInstance();
            const allActive = api.getAllCommands();
            const usageBoostFn = item => Math.min(Math.log2((item.usageCount || 0) + 1) * 5, 25);

            // #tag prefix search
            const tagMatch = query.match(/^#(\S+)\s*(.*)/);
            if (tagMatch) {
                const tag = tagMatch[1].toLowerCase();
                const searchQuery = tagMatch[2].trim();

                const filtered = allActive.filter(cmd =>
                    cmd.tags && cmd.tags.split(',').some(t => t.trim().toLowerCase() === tag)
                );

                if (searchQuery) {
                    const results = this.fuzzySearch.search(filtered, searchQuery, usageBoostFn);
                    this.setState({results: results.map(r => r.item)});
                } else {
                    this.setState({
                        results: filtered.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                    });
                }
                return;
            }

            const results = this.fuzzySearch.search(allActive, query, usageBoostFn);
            this.setState({results: results.map(r => r.item)});
        } catch (e) {
            this.setState({results: []});
        }
    }

    onKeyDown = (e) => {
        const {results, selectedIndex, paramForm, showQuickSave} = this.state;

        if (e.keyCode === Keys.escape) {
            if (paramForm) {
                this.setState({paramForm: null, paramValues: {}});
            } else if (showQuickSave) {
                this.setState({showQuickSave: false});
                if (this.searchInput) this.searchInput.focus();
            } else {
                ipcRenderer.invoke('hide-search-panel');
            }
            return;
        }

        if (paramForm || showQuickSave) return;

        if (e.keyCode === Keys.downArrow) {
            e.preventDefault();
            const newIndex = Math.min(selectedIndex + 1, results.length - 1);
            this.setState({selectedIndex: newIndex}, () => this.scrollToSelected());
        } else if (e.keyCode === Keys.upArrow) {
            e.preventDefault();
            const newIndex = Math.max(selectedIndex - 1, 0);
            this.setState({selectedIndex: newIndex}, () => this.scrollToSelected());
        } else if (e.keyCode === Keys.enter) {
            e.preventDefault();
            if (results.length > 0 && results[selectedIndex]) {
                this.selectCommand(results[selectedIndex]);
            }
        }
    }

    scrollToSelected = () => {
        const el = document.querySelector('.result-item.selected');
        if (el) el.scrollIntoView({block: 'nearest'});
    }

    selectCommand = (item) => {
        const commandParams = CommandHelpers.organizeCommands(item.command);

        if (commandParams.length > 0) {
            let paramValues = {};
            commandParams.forEach(p => {
                paramValues[p.id] = p.value || '';
            });
            this.setState({paramForm: {item, params: commandParams}, paramValues});
        } else {
            this.copyAndClose(item, item.command);
        }
    }

    copyAndClose = (item, finalCommand) => {
        clipboard.writeText(finalCommand);
        try {
            Api.getInstance().incrementUsage(item.id);
        } catch (e) { /* ignore */ }

        const autoClose = StorageHelpers.preference.get('autoCloseAfterCopy') !== false;
        if (autoClose) {
            ipcRenderer.invoke('hide-search-panel');
        } else {
            this.setState({paramForm: null, paramValues: {}});
        }
    }

    onParamCopy = () => {
        const {paramForm, paramValues} = this.state;
        const finalCommand = CommandHelpers.replacedCommand(paramForm.item.command, paramValues);
        this.copyAndClose(paramForm.item, finalCommand);
    }

    onClickQuickSave = () => {
        const {query} = this.state;
        this.setState({
            showQuickSave: true,
            quickSaveForm: {title: '', command: '', tags: query || ''}
        });
    }

    onSubmitQuickSave = () => {
        const {quickSaveForm} = this.state;

        if (!quickSaveForm.title.trim() || !quickSaveForm.command.trim()) return;

        const newItem = {
            id: shortid.generate(),
            title: quickSaveForm.title.trim(),
            command: quickSaveForm.command.trim(),
            tags: quickSaveForm.tags.trim(),
            description: '',
            isFavourite: false,
            isTrash: false,
            usageCount: 0,
            lastUsedAt: null
        };

        try {
            Api.getInstance().addNewCommandItem(newItem);
        } catch (e) { /* ignore */ }

        this.setState({showQuickSave: false, quickSaveForm: {title: '', command: '', tags: ''}});
        this.performSearch(this.state.query);
        if (this.searchInput) this.searchInput.focus();
    }

    truncate = (text, len) => {
        if (!text) return '';
        return text.length > len ? text.substring(0, len) + '...' : text;
    }

    renderParamForm = () => {
        const {paramForm, paramValues} = this.state;
        if (!paramForm) return null;

        return (
            <div className="param-form">
                <div className="qs-title">Fill Parameters</div>
                {paramForm.params.map((p) => (
                    <div key={p.id} className="param-field">
                        <label>{p.name}</label>
                        {p.type === 'choice' ? (
                            <select
                                value={paramValues[p.id] || ''}
                                onChange={e => this.setState({
                                    paramValues: {...paramValues, [p.id]: e.target.value}
                                })}
                            >
                                {p.value.split(',').map((opt, i) => (
                                    <option key={i} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={paramValues[p.id] || ''}
                                onChange={e => this.setState({
                                    paramValues: {...paramValues, [p.id]: e.target.value}
                                })}
                            />
                        )}
                    </div>
                ))}
                <div className="qs-buttons">
                    <button className="btn btn-default"
                            onClick={() => this.setState({paramForm: null, paramValues: {}})}>Cancel
                    </button>
                    <button className="btn btn-success" onClick={this.onParamCopy}>Copy</button>
                </div>
            </div>
        );
    }

    renderQuickSaveForm = () => {
        const {showQuickSave, quickSaveForm} = this.state;
        if (!showQuickSave) return null;

        return (
            <div className="quick-save-form">
                <div className="qs-title">New Command Snippet</div>
                <input
                    type="text"
                    placeholder="Title *"
                    value={quickSaveForm.title}
                    onChange={e => this.setState({
                        quickSaveForm: {...quickSaveForm, title: e.target.value}
                    })}
                    autoFocus
                />
                <textarea
                    placeholder="Command *"
                    rows={3}
                    value={quickSaveForm.command}
                    onChange={e => this.setState({
                        quickSaveForm: {...quickSaveForm, command: e.target.value}
                    })}
                />
                <input
                    type="text"
                    placeholder="Tags (comma-separated)"
                    value={quickSaveForm.tags}
                    onChange={e => this.setState({
                        quickSaveForm: {...quickSaveForm, tags: e.target.value}
                    })}
                />
                <div className="qs-buttons">
                    <button className="btn btn-default"
                            onClick={() => {
                                this.setState({showQuickSave: false});
                                if (this.searchInput) this.searchInput.focus();
                            }}>Cancel
                    </button>
                    <button className="btn btn-success" onClick={this.onSubmitQuickSave}>Save</button>
                </div>
            </div>
        );
    }

    render() {
        const {query, results, selectedIndex, paramForm, showQuickSave} = this.state;

        return (
            <div className="comp_quick-search-panel" onKeyDown={this.onKeyDown} tabIndex={-1}>
                <div className="search-input-area">
                    <input
                        ref={ref => this.searchInput = ref}
                        type="text"
                        placeholder="Search commands or #tag..."
                        value={query}
                        onChange={this.onSearchChange}
                        autoFocus
                    />
                    <button className="btn-add" title="New Snippet" onClick={this.onClickQuickSave}>+</button>
                </div>

                {paramForm && this.renderParamForm()}

                {showQuickSave && this.renderQuickSaveForm()}

                {!paramForm && !showQuickSave && (
                    <div className="results-list">
                        {query === '' && results.length > 0 && (
                            <div className="section-label">Recently Used</div>
                        )}
                        {results.length === 0 && query !== '' && (
                            <div className="empty-state">
                                <div className="empty-text">No results found</div>
                                <button className="btn btn-default btn-new" onClick={this.onClickQuickSave}>
                                    Add New Snippet
                                </button>
                            </div>
                        )}
                        {results.map((item, index) => {
                            const tags = item.tags && item.tags !== '' ? item.tags.split(',') : [];

                            return (
                                <div
                                    key={item.id}
                                    className={`result-item${index === selectedIndex ? ' selected' : ''}`}
                                    onClick={() => this.selectCommand(item)}
                                    onMouseEnter={() => this.setState({selectedIndex: index})}
                                >
                                    <div className="result-title">{item.title}</div>
                                    <div className="result-command"
                                         dangerouslySetInnerHTML={{__html: CommandHelpers.commandAsHtml(item.command)}}
                                    />
                                    {tags.length > 0 && (
                                        <div className="result-tags">
                                            {tags.slice(0, 5).map((tag, i) => (
                                                <span key={i}>#{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
}

export default QuickSearchPanel;
