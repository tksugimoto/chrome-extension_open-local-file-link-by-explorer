import common from './common.js';
import {
	CONTEXT_MENU_ID,
	createContextMenu,
} from './context-menu.js';
import notificationUtil from './notification-util.js';

chrome.runtime.onInstalled.addListener(details => {
	if (details.reason === 'update') {
		const updateRequiredPreviousVersions = [
			'0.0.1',
		];
		if (updateRequiredPreviousVersions.includes(details.previousVersion)) {
			chrome.tabs.create({
				url: `${chrome.runtime.getManifest().options_page}#update-notification`,
			});
		}
		return;
	}
	if (details.reason === 'install') {
		chrome.runtime.openOptionsPage();
	}
});

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
	const extractResult = extractFilePath(info);
	if (!extractResult.isSucceeded) {
		notificationUtil.showNotification({
			resultMessage: 'ファイルパスではありません',
			path: extractResult.target,
		});
		return;
	}
	const messageToNative = {
		filePath: extractResult.path,
	};
	chrome.runtime.sendNativeMessage(common.applicationName, messageToNative, response => {
		console.info(response);

		notificationUtil.showNotification(response);
	});
});

class ExtractResult {
	constructor(target, path) {
		this.target = target;
		this.isSucceeded = !!path;
		this.path = path;
	}

	static ofFailure(target) {
		return new this(target, null);
	}
}

const extractFilePath = info => {
	if (info.menuItemId === CONTEXT_MENU_ID.PAGE) {
		const pageUrl = info.pageUrl;
		return new ExtractResult(pageUrl, convertUrl2FilePath(pageUrl));
	}
	if (info.menuItemId === CONTEXT_MENU_ID.LINK) {
		const linkUrl = info.linkUrl;
		if (!linkUrl.startsWith('file://')) {
			// link 要素用の右クリックメニューの表示対象を <all_urls> にしているため fileスキーマ以外を無視する
			return ExtractResult.ofFailure(linkUrl);
		}
		return new ExtractResult(linkUrl, convertUrl2FilePath(linkUrl));
	}
	if (info.menuItemId === CONTEXT_MENU_ID.SELECTION) {
		const selectionText = info.selectionText;
		if (selectionText.startsWith('"') && selectionText.endsWith('"')) {
			return new ExtractResult(selectionText, selectionText.slice(1, -1));
		}
		return new ExtractResult(selectionText, selectionText);
	}
};

const convertUrl2FilePath = encodedUrl => {
	// 1. hash除去 (例えば、PDFのページ指定時の #page=12)
	// 2. %23 -> # 変換のために decodeURI ではなく decodeURIComponent を使用
	const decodedURI = decodeURIComponent(encodedUrl.replace(/#.*/, ''));
	if (decodedURI.startsWith('file:///')) {
		return decodedURI.replace(/^file:\/\/\//, '').replace(/\//g, '\\');
	}
	// UNC path ( "\\server_name\path\to\file" )
	// file://server_name/path/to/file
	return decodedURI.replace(/^file:/, '').replace(/\//g, '\\');
};
