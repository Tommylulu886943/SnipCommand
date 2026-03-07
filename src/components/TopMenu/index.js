import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ipcRenderer } from "electron";
import { connect } from "react-redux";

import SvgIcon from '../SvgIcon';
import { SearchField } from "../FormElements";
import { ReduxHelpers } from "../../core/Helpers";
import { SET_SEARCH_QUERY } from "../../redux/actions/searchActions";
import { MainMenus, SearchResult } from "../../core/Constants";
import SettingsModal from "../SettingsModal";

import './style.scss';


class TopMenu extends Component {
    state = {
        maximize: false,
        showSettingsModal: false,
        settingsSelectedTab: 'general',
        isWindows: process.platform === 'win32'
    }

    componentDidMount() {
        const { isWindows } = this.state;

        this._appMenuHandler = (event, args) => {
            if (args.type === 'preferences') {
                this.setState({ showSettingsModal: true, settingsSelectedTab: args.tab });
            }
        };
        ipcRenderer.on('appMenu', this._appMenuHandler);

        if (isWindows) {
            this.onResizeWindow();
            this.refMenu.addEventListener('click', this.onClickMenu);
            this.refClose.addEventListener('click', this.onClickClose);
            this.refMinimize.addEventListener('click', this.onClickMinimize);
            this.refMaximize.addEventListener('click', this.onClickMaximize);
            window.addEventListener('resize', this.onResizeWindow);
        }
    }

    componentWillUnmount() {
        const { isWindows } = this.state;

        ipcRenderer.removeListener('appMenu', this._appMenuHandler);

        if (isWindows) {
            this.refMenu.removeEventListener('click', this.onClickMenu);
            this.refClose.removeEventListener('click', this.onClickClose);
            this.refMinimize.removeEventListener('click', this.onClickMinimize);
            this.refMaximize.removeEventListener('click', this.onClickMaximize);
            window.removeEventListener('resize', this.onResizeWindow);
        }
    }

    onClickClose = () => ipcRenderer.invoke('window-close');
    onClickMenu = async e => await ipcRenderer.invoke('display-app-menu', { x: e.x, y: e.y });
    onClickMinimize = () => ipcRenderer.invoke('window-minimize');
    onClickMaximize = () => ipcRenderer.invoke('window-maximize');
    onResizeWindow = async () => {
        const isMaximized = await ipcRenderer.invoke('window-is-maximized');
        this.setState({ maximize: isMaximized });
    };

    onChangeText = (text) => {
        const { setQuery, setSelectedMenu, setCommandList } = this.props;
        const selectedMenu = text === "" ? MainMenus[0] : SearchResult;
        setQuery(text);
        setSelectedMenu(selectedMenu);
        setCommandList(selectedMenu, text);
    }

    render() {
        const { maximize, showSettingsModal, isWindows, settingsSelectedTab } = this.state;
        const { query } = this.props;

        return (
            <div className="comp_topmenu">
                <SettingsModal
                    show={showSettingsModal}
                    selectedTab={settingsSelectedTab}
                    onClose={() => this.setState({ showSettingsModal: false })}
                    tabChanged={settingsSelectedTab => this.setState({ settingsSelectedTab })}
                />

                <div className="left-side">
                    {
                        isWindows
                            ? (
                                <button ref={ref => this.refMenu = ref} className="btn-menubar menu" type="button">
                                    <span />
                                    <span />
                                    <span />
                                </button>
                            )
                            : null
                    }
                </div>

                <div className="center-side">
                    <SearchField
                        placeholder="Search commands or #tag..."
                        value={query}
                        onChangeText={text => this.onChangeText(text)}
                        onClearClick={() => this.onChangeText("")}
                    />
                </div>
                <div className="right-side">
                    <button className="btn-preferences" title="Preferences"
                        onClick={() => this.setState({ showSettingsModal: true, settingsSelectedTab: 'general' })}>
                        <SvgIcon name="settings" />
                    </button>
                    {
                        isWindows
                            ? (
                                <div className="command-buttons">
                                    <button ref={ref => this.refMinimize = ref} className="btn-menubar minimize">
                                        <SvgIcon name="minimize" />
                                    </button>
                                    <button ref={ref => this.refMaximize = ref} className="btn-menubar maximize">
                                        <SvgIcon name={maximize ? "maximized" : "maximize"} />
                                    </button>
                                    <button ref={ref => this.refClose = ref} className="btn-menubar close">
                                        <SvgIcon name="close" />
                                    </button>
                                </div>
                            )
                            : null
                    }
                </div>
            </div>
        )
    }
}

TopMenu.defaultProps = {
    onClickSettings: PropTypes.func
}

const mapStateToProps = state => {
    const { query } = state.search;
    return { query };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setSelectedMenu: selectedMenu => ReduxHelpers.setSelectedMenu(dispatch, selectedMenu),
        setQuery: (query) => dispatch({ type: SET_SEARCH_QUERY, payload: query }),
        setCommandList: (selectedMenu, query) => ReduxHelpers.fillCommands(dispatch, selectedMenu, query)
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(TopMenu);