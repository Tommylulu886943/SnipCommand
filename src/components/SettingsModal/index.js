import React from 'react';
import PropTypes from 'prop-types';
import {connect} from "react-redux";
import {ipcRenderer, shell} from 'electron';

import Modal from "../Modal";
import {Button, TextField} from "../FormElements";
import {NotyHelpers, ReduxHelpers, StorageHelpers} from "../../core/Helpers";
import {openConfirmDialog} from "../ConfirmDialog";
import {MainMenus} from "../../core/Constants";
import {version, description, author, links} from '../../../package.json';

import './style.scss';


class SettingsModal extends React.Component {
    state = {
        dbDirectory: '',
        backupDirectory: '',
        backupFiles: [],
        appTheme: 'light',
        globalHotkey: 'Alt+C',
        quickAddHotkey: 'Alt+Z',
        autoCloseAfterCopy: true,
        autoPaste: true,
        recentCount: 10,
        panelPosition: 'center',
        recordingTarget: null,
        autoCheckUpdate: true,
        updateStatus: 'idle',
        updateVersion: '',
        updatePercent: 0,
        updateError: ''
    }

    componentDidMount() {
        const dbDirectory = StorageHelpers.preference.get('storagePath');
        const backupDirectory = StorageHelpers.preference.get('backupPath');
        const appTheme = StorageHelpers.preference.get('appTheme') || 'light';
        const globalHotkey = StorageHelpers.preference.get('globalHotkey') || 'Alt+C';
        const quickAddHotkey = StorageHelpers.preference.get('quickAddHotkey') || 'Alt+Z';
        const autoCloseAfterCopy = StorageHelpers.preference.get('autoCloseAfterCopy') !== false;
        const autoPaste = StorageHelpers.preference.get('autoPaste') !== false;
        const recentCount = StorageHelpers.preference.get('recentCount') || 10;
        const panelPosition = StorageHelpers.preference.get('panelPosition') || 'center';
        const autoCheckUpdate = StorageHelpers.preference.get('autoCheckUpdate') !== false;
        this.setState({dbDirectory, backupDirectory, appTheme, globalHotkey, quickAddHotkey, autoCloseAfterCopy, autoPaste, recentCount, panelPosition, autoCheckUpdate});
        this.listBackupFiles();

        this._updateHandler = (event, data) => {
            const stateUpdate = { updateStatus: data.status };
            if (data.version) stateUpdate.updateVersion = data.version;
            if (data.percent !== undefined) stateUpdate.updatePercent = data.percent;
            if (data.message) stateUpdate.updateError = data.message;
            this.setState(stateUpdate);
        };
        ipcRenderer.on('update-status', this._updateHandler);
    }

    componentWillUnmount() {
        if (this.state.recordingTarget) {
            document.removeEventListener('keydown', this.handleHotkeyCapture);
        }
        if (this._updateHandler) {
            ipcRenderer.removeListener('update-status', this._updateHandler);
        }
    }

    onClickTabHeader = selectedTab => {
        const {tabChanged} = this.props;
        tabChanged && tabChanged(selectedTab);
    }

    openMoveStorage = async type => {
        const {setCommandList} = this.props;

        const dir = await ipcRenderer.invoke('show-open-dialog', {
            properties: ['openDirectory']
        });

        if (dir !== undefined) {
            if (type === 'move') {
                StorageHelpers.moveDb(dir[0]);
            } else {
                StorageHelpers.preference.set('storagePath', dir[0]);
                NotyHelpers.open('The storage opened successfully!', 'success', 2500);
                setCommandList();
            }
            this.setState({dbDirectory: dir[0]});
        }
    }

    changeOrBackupNow = async type => {
        if (type === 'change') {
            const dir = await ipcRenderer.invoke('show-open-dialog', {
                properties: ['openDirectory']
            });

            if (dir !== undefined) {
                StorageHelpers.preference.set('backupPath', dir[0]);
                this.setState({backupDirectory: dir[0]});
            }
        } else {
            StorageHelpers.backupNow();
            this.listBackupFiles();
            NotyHelpers.open('The backup process has been finished successfully!', 'success', 2500);
        }
    }

    restoreFromBackup = file => {
        const {setCommandList} = this.props;

        openConfirmDialog({
            title: 'Confirmation',
            text: 'Are you sure want to restore from backup? The current library will be overwritten!',
            buttons: [
                {
                    label: 'Yes',
                    onClick: () => {
                        StorageHelpers.restoreDb(file.filePath);
                        NotyHelpers.open('The storage restored from backup file successfully!', 'success', 2500);
                        setCommandList();
                    },
                    className: 'btn btn-success'
                },
                {
                    label: 'No',
                    onClick: () => null,
                    className: 'btn btn-default'
                }
            ]
        });
    }

    listBackupFiles = () => {
        const backupFiles = StorageHelpers.backupFiles();
        this.setState({backupFiles});
    }

    openLinkInBrowser = async slug => {
        await shell.openExternal(links[slug]);
    }

    changeTheme = appTheme => {
        document.body.classList.remove('light-theme');
        document.body.classList.remove('dark-theme');
        document.body.classList.add(`${appTheme}-theme`);
        StorageHelpers.preference.set('appTheme', appTheme);

        this.setState({appTheme});
    }

    toggleHotkeyRecording = (target) => {
        const {recordingTarget} = this.state;
        if (recordingTarget) {
            this.setState({recordingTarget: null});
            document.removeEventListener('keydown', this.handleHotkeyCapture);
            if (recordingTarget === target) return;
        }
        this.setState({recordingTarget: target});
        document.addEventListener('keydown', this.handleHotkeyCapture);
    }

    handleHotkeyCapture = (e) => {
        e.preventDefault();
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Super');

        const key = e.key;
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
            parts.push(key.length === 1 ? key.toUpperCase() : key);
            const hotkey = parts.join('+');
            const {recordingTarget} = this.state;

            const prefKey = recordingTarget === 'quickAdd' ? 'quickAddHotkey' : 'globalHotkey';
            const stateKey = recordingTarget === 'quickAdd' ? 'quickAddHotkey' : 'globalHotkey';
            const label = recordingTarget === 'quickAdd' ? 'Quick Add' : 'Quick Search';

            StorageHelpers.preference.set(prefKey, hotkey);
            this.setState({[stateKey]: hotkey, recordingTarget: null});
            document.removeEventListener('keydown', this.handleHotkeyCapture);

            ipcRenderer.invoke('update-global-hotkeys');
            NotyHelpers.open(`${label} hotkey updated to: ${hotkey}`, 'success', 2500);
        }
    }

    toggleAutoClose = () => {
        const newVal = !this.state.autoCloseAfterCopy;
        StorageHelpers.preference.set('autoCloseAfterCopy', newVal);
        this.setState({autoCloseAfterCopy: newVal});
    }

    toggleAutoPaste = () => {
        const newVal = !this.state.autoPaste;
        StorageHelpers.preference.set('autoPaste', newVal);
        this.setState({autoPaste: newVal});
    }

    onRecentCountChange = (e) => {
        const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 10));
        StorageHelpers.preference.set('recentCount', val);
        this.setState({recentCount: val});
    }

    onPanelPositionChange = (e) => {
        const val = e.target.value;
        StorageHelpers.preference.set('panelPosition', val);
        this.setState({panelPosition: val});
    }

    toggleAutoCheckUpdate = () => {
        const newVal = !this.state.autoCheckUpdate;
        StorageHelpers.preference.set('autoCheckUpdate', newVal);
        this.setState({autoCheckUpdate: newVal});
    }

    onCheckForUpdates = () => {
        this.setState({updateStatus: 'checking', updateError: ''});
        ipcRenderer.invoke('check-for-updates');
    }

    onDownloadUpdate = () => {
        this.setState({updateStatus: 'downloading', updatePercent: 0});
        ipcRenderer.invoke('download-update');
    }

    onInstallUpdate = () => {
        ipcRenderer.invoke('install-update');
    }

    renderUpdateStatus = () => {
        const {updateStatus, updateVersion, updatePercent, updateError} = this.state;

        switch (updateStatus) {
            case 'checking':
                return <div className="update-status">Checking for updates...</div>;
            case 'available':
                return (
                    <div className="update-status">
                        <div className="update-available">
                            New version <b>{updateVersion}</b> is available!
                        </div>
                        <Button text="Download Update" styleType="success" onClick={this.onDownloadUpdate}/>
                    </div>
                );
            case 'downloading':
                return (
                    <div className="update-status">
                        <div>Downloading update... {updatePercent}%</div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{width: `${updatePercent}%`}}/>
                        </div>
                    </div>
                );
            case 'downloaded':
                return (
                    <div className="update-status">
                        <div className="update-available">Update downloaded and ready to install!</div>
                        <Button text="Restart & Install" styleType="success" onClick={this.onInstallUpdate}/>
                    </div>
                );
            case 'not-available':
                return <div className="update-status success">You are using the latest version.</div>;
            case 'error':
                return <div className="update-status error">Update check failed: {updateError}</div>;
            default:
                return null;
        }
    }

    render() {
        const {dbDirectory, backupDirectory, backupFiles, appTheme, globalHotkey, quickAddHotkey, autoCloseAfterCopy, autoPaste, recentCount, panelPosition, recordingTarget} = this.state;
        const {show, onClose, selectedTab} = this.props;

        return (
            <div className="comp_settings-modal">
                <Modal
                    show={show}
                    onClose={onClose}
                    title={"PREFERENCES"}>

                    <div className="tabs-header-container">
                        <ul>
                            <li
                                className={selectedTab === 'general' ? 'active' : ''}
                                onClick={() => this.onClickTabHeader('general')}
                            >
                                <span>General</span>
                            </li>
                            <li
                                className={selectedTab === 'storage' ? 'active' : ''}
                                onClick={() => this.onClickTabHeader('storage')}
                            >
                                <span>Storage</span>
                            </li>
                            <li
                                className={selectedTab === 'themes' ? 'active' : ''}
                                onClick={() => this.onClickTabHeader('themes')}
                            >
                                <span>Themes</span>
                            </li>
                            <li
                                className={selectedTab === 'update' ? 'active' : ''}
                                onClick={() => this.onClickTabHeader('update')}
                            >
                                <span>Update</span>
                            </li>
                            <li
                                className={selectedTab === 'about' ? 'active' : ''}
                                onClick={() => this.onClickTabHeader('about')}
                            >
                                <span>About</span>
                            </li>
                        </ul>
                    </div>
                    <div className="tabs-content-container">
                        <div className={`content${selectedTab === 'general' ? ' active' : ''}`}>
                            <div className="general-section">
                                <div className="sub-title">Quick Search Hotkey</div>
                                <div className="info">
                                    Press "Record" and type your desired key combination to change the global hotkey.
                                </div>
                                <div className="hotkey-recorder">
                                    <div className="hotkey-display">
                                        <TextField
                                            name="hotkey"
                                            readOnly={true}
                                            value={recordingTarget === 'search' ? "Press keys..." : globalHotkey}
                                        />
                                    </div>
                                    <Button
                                        text={recordingTarget === 'search' ? "Cancel" : "Record"}
                                        styleType="default"
                                        onClick={() => this.toggleHotkeyRecording('search')}
                                    />
                                </div>

                                <div className="sub-title" style={{marginTop: 20}}>Quick Add Hotkey</div>
                                <div className="info">
                                    Press "Record" and type your desired key combination. This hotkey captures the selected text from the active window and opens the Quick Add panel.
                                </div>
                                <div className="hotkey-recorder">
                                    <div className="hotkey-display">
                                        <TextField
                                            name="quickAddHotkey"
                                            readOnly={true}
                                            value={recordingTarget === 'quickAdd' ? "Press keys..." : quickAddHotkey}
                                        />
                                    </div>
                                    <Button
                                        text={recordingTarget === 'quickAdd' ? "Cancel" : "Record"}
                                        styleType="default"
                                        onClick={() => this.toggleHotkeyRecording('quickAdd')}
                                    />
                                </div>

                                <div className="sub-title" style={{marginTop: 20}}>Behavior</div>
                                <div className="checkbox-container">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={autoCloseAfterCopy}
                                            onChange={this.toggleAutoClose}
                                        />
                                        <span>Auto-close search panel after copying command</span>
                                    </label>
                                </div>
                                <div className="checkbox-container">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={autoPaste}
                                            onChange={this.toggleAutoPaste}
                                        />
                                        <span>Auto-paste to active window after copying (requires auto-close)</span>
                                    </label>
                                </div>

                                <div className="sub-title" style={{marginTop: 20}}>Quick Search Panel</div>
                                <div className="number-field-container">
                                    <label>Recently used items to display</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={recentCount}
                                        onChange={this.onRecentCountChange}
                                    />
                                </div>
                                <div className="select-field-container">
                                    <label>Panel position</label>
                                    <select value={panelPosition} onChange={this.onPanelPositionChange}>
                                        <option value="center">Center</option>
                                        <option value="top-center">Top Center</option>
                                        <option value="bottom-center">Bottom Center</option>
                                        <option value="top-left">Top Left</option>
                                        <option value="top-right">Top Right</option>
                                        <option value="bottom-left">Bottom Left</option>
                                        <option value="bottom-right">Bottom Right</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className={`content${selectedTab === 'storage' ? ' active' : ''}`}>
                            <div className="storage-directory-container">
                                <div className="sub-title">Storage Directory</div>
                                <div className="info">To use sync services like iCloud Drive, Google Drive of Dropbox,
                                    simply move storage to the corresponding synced folders.
                                </div>

                                <div className="form-container">
                                    <div className="input-container">
                                        <TextField
                                            name={""}
                                            readOnly={true}
                                            value={dbDirectory}
                                        />
                                    </div>
                                    <div className="buttons-container">
                                        <Button
                                            text={"Open Directory..."}
                                            styleType={"default"}
                                            title={"Open Storage Directory..."}
                                            onClick={() => this.openMoveStorage('open')}
                                        />

                                        <Button
                                            text={"Move Directory..."}
                                            styleType={"default"}
                                            title={"Move Storage Directory..."}
                                            onClick={() => this.openMoveStorage('move')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="storage-directory-backups-container">
                                <div className="sub-title">Storage Backups</div>
                                <div className="info">
                                    Backup will be created every 6 hours automatically when app is running.
                                </div>

                                <div className="form-container">
                                    <div className="input-container">
                                        <TextField
                                            name={""}
                                            readOnly={true}
                                            value={backupDirectory}
                                        />
                                    </div>
                                    <div className="buttons-container">
                                        <Button
                                            text={"Change Folder..."}
                                            styleType={"default"}
                                            onClick={() => this.changeOrBackupNow('change')}
                                        />

                                        <Button
                                            text={"Backup Now"}
                                            styleType={"default"}
                                            onClick={() => this.changeOrBackupNow('backup')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="storage-restore-container">
                                <div className="sub-title">Storage Restore</div>
                                <div className="info">You can restore from backups. Please be carefully when make this
                                    operation, because it will be overwritten!
                                </div>

                                <ul>
                                    {
                                        backupFiles.map((file, index) => {
                                            return (
                                                <li key={`restore_item_${index}`}>
                                                    <div className="name">{file?.name}</div>
                                                    <span onClick={() => this.restoreFromBackup(file)}>Restore</span>
                                                </li>
                                            )
                                        })
                                    }
                                </ul>
                            </div>

                        </div>
                        <div className={`content${selectedTab === 'themes' ? ' active' : ''}`}>
                            <div className="theme-section">
                                <ul>
                                    <li onClick={() => this.changeTheme('light')}
                                        className={appTheme === 'light' ? 'active' : ''}>
                                        <div className="image-container">
                                            <img src={"./images/themes/light-theme.png"} alt="Light Theme" width={240}/>
                                        </div>
                                        <div className="text-container">Light Theme</div>
                                    </li>
                                    <li onClick={() => this.changeTheme('dark')}
                                        className={appTheme === 'dark' ? 'active' : ''}>
                                        <div className="image-container">
                                            <img src={"./images/themes/dark-theme.png"} alt="Dark Theme" width={240}/>
                                        </div>
                                        <div className="text-container">Dark Theme</div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className={`content${selectedTab === 'update' ? ' active' : ''}`}>
                            <div className="update-section">
                                <div className="info">Current version: <b>{version}</b></div>

                                <div className="checkbox-container">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={this.state.autoCheckUpdate}
                                            onChange={this.toggleAutoCheckUpdate}
                                        />
                                        <span>Automatically check for updates on startup</span>
                                    </label>
                                </div>

                                <div className="update-actions">
                                    <Button
                                        text="Check For Updates"
                                        styleType="default"
                                        onClick={this.onCheckForUpdates}
                                    />
                                </div>

                                {this.renderUpdateStatus()}
                            </div>
                        </div>
                        <div className={`content${selectedTab === 'about' ? ' active' : ''}`}>
                            <div className="about-section">
                                <img src={'./images/logo/snip_command.png'} width={100} alt="SnipCommand"/>
                                <div className="product-name">SnipCommand <small>{version}</small></div>
                                <div className="description">{description}</div>
                                <div className="created-by">
                                    <div className="text">Created by</div>
                                    <div className="author" onClick={() => this.openLinkInBrowser('author-page')}>
                                        {author.name}
                                    </div>
                                </div>

                                <div className="link-list">
                                    <div className="link" onClick={() => this.openLinkInBrowser('project-page')}>
                                        GitHub Page
                                    </div>
                                    <div className="link" onClick={() => this.openLinkInBrowser('license')}>
                                        License
                                    </div>
                                    <div className="link" onClick={() => this.openLinkInBrowser('changelogs')}>
                                        Changelogs
                                    </div>
                                    <div className="link" onClick={() => this.openLinkInBrowser('documentation')}>
                                        Documentation
                                    </div>
                                    <div className="link" onClick={() => this.openLinkInBrowser('issues')}>
                                        Report An Issue
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            </div>
        )
    }
}

SettingsModal.propTypes = {
    show: PropTypes.bool,
    onClose: PropTypes.func,
    selectedTab: PropTypes.string,
    tabChanged: PropTypes.func
}

const mapDispatchToProps = (dispatch) => {
    return {
        setCommandList: () => ReduxHelpers.fillCommands(dispatch, MainMenus[0])
    }
}

export default connect(null, mapDispatchToProps)(SettingsModal);
