import React, {Component} from 'react';
import {ipcRenderer} from 'electron';
import shortid from 'shortid';

import Api from '../../core/Api';
import {StorageHelpers, TagHelpers} from '../../core/Helpers';
import {Keys} from '../../core/Constants';

import '../common.scss';
import './style.scss';


class QuickAddPanel extends Component {
    constructor(props) {
        super(props);
        this.setTheme();
        StorageHelpers.initDb();

        this.state = {
            title: '',
            command: '',
            tags: '',
            description: '',
            autoSuggest: [],
            tagInput: '',
            showSuggestions: false
        };
    }

    componentDidMount() {
        this._shownHandler = (event, data) => {
            const selectedText = (data && data.selectedText) || '';
            const suggestions = this.loadSuggestions();
            this.setState({
                title: '',
                command: selectedText,
                tags: '',
                description: '',
                autoSuggest: suggestions,
                tagInput: '',
                showSuggestions: false
            }, () => {
                if (this.titleInput) this.titleInput.focus();
            });
        };

        ipcRenderer.on('quick-add-shown', this._shownHandler);

        // Pull initial data (first open — IPC event may arrive before mount)
        ipcRenderer.invoke('get-quick-add-data').then(data => {
            const selectedText = (data && data.selectedText) || '';
            const suggestions = this.loadSuggestions();
            this.setState({
                command: selectedText,
                autoSuggest: suggestions
            }, () => {
                if (this.titleInput) this.titleInput.focus();
            });
        });
    }

    componentWillUnmount() {
        ipcRenderer.removeListener('quick-add-shown', this._shownHandler);
    }

    setTheme = () => {
        const theme = `${StorageHelpers.preference.get('appTheme') || 'light'}-theme`;
        if (!document.body.classList.contains(theme)) document.body.classList.add(theme);
    }

    loadSuggestions = () => {
        try {
            return TagHelpers.getAllItems();
        } catch (e) {
            return [];
        }
    }

    onKeyDown = (e) => {
        if (e.keyCode === Keys.escape) {
            ipcRenderer.invoke('hide-quick-add-panel');
        }
    }

    onSave = () => {
        const {title, command, tags, description} = this.state;

        if (!title.trim() || !command.trim()) return;

        const newItem = {
            id: shortid.generate(),
            title: title.trim(),
            command: command.trim(),
            tags: tags.trim(),
            description: description.trim(),
            isFavourite: false,
            isTrash: false,
            usageCount: 0,
            lastUsedAt: null
        };

        try {
            Api.getInstance().addNewCommandItem(newItem);
        } catch (e) { /* ignore */ }

        ipcRenderer.invoke('hide-quick-add-panel');
    }

    onTagInputKeyDown = (e) => {
        if (e.keyCode === Keys.enter) {
            e.preventDefault();
            this.addTag(this.state.tagInput.trim());
        }
    }

    addTag = (tag) => {
        if (!tag) return;
        const {tags} = this.state;
        const existing = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        if (!existing.includes(tag)) {
            existing.push(tag);
        }
        this.setState({tags: existing.join(','), tagInput: '', showSuggestions: false});
    }

    removeTag = (index) => {
        const {tags} = this.state;
        const arr = tags.split(',').map(t => t.trim()).filter(Boolean);
        arr.splice(index, 1);
        this.setState({tags: arr.join(',')});
    }

    render() {
        const {title, command, tags, description, autoSuggest, tagInput, showSuggestions} = this.state;
        const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const filteredSuggestions = tagInput
            ? autoSuggest.filter(s =>
                s.toLowerCase().includes(tagInput.toLowerCase()) && !tagArr.includes(s)
            ).slice(0, 8)
            : [];

        return (
            <div className="comp_quick-add-panel" onKeyDown={this.onKeyDown} tabIndex={-1}>
                <div className="panel-header">
                    <span className="panel-title">New Command Snippet</span>
                    <button
                        className="btn-close-panel"
                        onClick={() => ipcRenderer.invoke('hide-quick-add-panel')}
                    >&times;</button>
                </div>

                <div className="panel-body">
                    <div className="field-group">
                        <label>Title <span className="required">*</span></label>
                        <input
                            ref={ref => this.titleInput = ref}
                            type="text"
                            placeholder="e.g. Docker restart all containers"
                            value={title}
                            onChange={e => this.setState({title: e.target.value})}
                            autoFocus
                        />
                    </div>

                    <div className="field-group">
                        <label>Command <span className="required">*</span></label>
                        <textarea
                            rows={4}
                            placeholder="Paste or type your command here"
                            value={command}
                            onChange={e => this.setState({command: e.target.value})}
                        />
                    </div>

                    <div className="field-group">
                        <label>Tags</label>
                        <div className="tags-input-area">
                            {tagArr.map((tag, i) => (
                                <span key={i} className="tag-chip">
                                    {tag}
                                    <button onClick={() => this.removeTag(i)}>&times;</button>
                                </span>
                            ))}
                            <input
                                type="text"
                                className="tag-text-input"
                                placeholder={tagArr.length === 0 ? "Type and press Enter" : ""}
                                value={tagInput}
                                onChange={e => this.setState({
                                    tagInput: e.target.value,
                                    showSuggestions: e.target.value.length > 0
                                })}
                                onKeyDown={this.onTagInputKeyDown}
                                onFocus={() => tagInput && this.setState({showSuggestions: true})}
                                onBlur={() => setTimeout(() => this.setState({showSuggestions: false}), 150)}
                            />
                        </div>
                        {showSuggestions && filteredSuggestions.length > 0 && (
                            <div className="tag-suggestions">
                                {filteredSuggestions.map((s, i) => (
                                    <div key={i} className="suggestion-item"
                                         onMouseDown={() => this.addTag(s)}>{s}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="field-group">
                        <label>Description</label>
                        <textarea
                            rows={2}
                            placeholder="Optional notes"
                            value={description}
                            onChange={e => this.setState({description: e.target.value})}
                        />
                    </div>
                </div>

                <div className="panel-footer">
                    <button className="btn btn-default"
                            onClick={() => ipcRenderer.invoke('hide-quick-add-panel')}>Cancel
                    </button>
                    <button className="btn btn-success" onClick={this.onSave}>Save</button>
                </div>
            </div>
        );
    }
}

export default QuickAddPanel;
