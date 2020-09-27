import toastr from 'toastr';
import { Meteor } from 'meteor/meteor';
import { ReactiveDict } from 'meteor/reactive-dict';
import { ReactiveVar } from 'meteor/reactive-var';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';

import { t, roomTypes, handleError } from '../../../../utils';
import { TabBar, fireGlobalEvent, call } from '../../../../ui-utils';
import { ChatSubscription, Rooms, ChatRoom } from '../../../../models';
import { settings } from '../../../../settings';
import { emoji } from '../../../../emoji';
import { Markdown } from '../../../../markdown/client';
import { hasAllPermission } from '../../../../authorization';
import { getUidDirectMessage } from '../../../../ui-utils/client/lib/getUidDirectMessage';

import './headerRoom.html';

const getUserStatus = (id) => {
	const roomData = Session.get(`roomData${ id }`);
	return roomTypes.getUserStatus(roomData.t, id);
};

const getUserStatusText = (id) => {
	const roomData = Session.get(`roomData${ id }`);
	return roomTypes.getUserStatusText(roomData.t, id);
};

Template.headerRoom.helpers({
	isDiscussion: () => Template.instance().state.get('discussion'),
	hasPresence() {
		const room = Rooms.findOne(this._id);
		return !roomTypes.getConfig(room.t).isGroupChat(room);
	},
	isDirect() { return Rooms.findOne(this._id).t === 'd'; },
	isToggleFavoriteButtonVisible: () => Template.instance().state.get('favorite') !== null,
	isToggleFavoriteButtonChecked: () => Template.instance().state.get('favorite'),
	toggleFavoriteButtonIconLabel: () => (Template.instance().state.get('favorite') ? t('Unfavorite') : t('Favorite')),
	toggleFavoriteButtonIcon: () => (Template.instance().state.get('favorite') ? 'star-filled' : 'star'),
	// iframeUrl: () => ((process.env.NODE_ENV === 'development' ? 'http://192.168.2.147:8081' : 'https://mp.cms.jojo.la') + '/pages/chat/chatHeaderInIframe?site=' + Meteor._localStorage.getItem('Cms.site') + '&tn=' + Meteor._localStorage.getItem('Cms.token')),
	uid() {
		return getUidDirectMessage(this._id);
	},
	back() {
		return Template.instance().data.back;
	},
	avatarBackground() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }
		return roomTypes.getConfig(roomData.t).getAvatarPath(roomData);
	},
	buttons() {
		return TabBar.getButtons();
	},

	isTranslated() {
		const sub = ChatSubscription.findOne({ rid: this._id }, { fields: { autoTranslate: 1, autoTranslateLanguage: 1 } });
		return settings.get('AutoTranslate_Enabled') && ((sub != null ? sub.autoTranslate : undefined) === true) && (sub.autoTranslateLanguage != null);
	},
	roomName() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }

		return roomTypes.getRoomName(roomData.t, roomData);
	},

	secondaryName() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }

		return roomTypes.getSecondaryRoomName(roomData.t, roomData);
	},

	roomTopic() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData || !roomData.topic) { return ''; }

		let roomTopic = Markdown.parse(roomData.topic.replace(/\n/mg, ' '));

		// &#39; to apostrophe (') for emojis such as :')
		roomTopic = roomTopic.replace(/&#39;/g, '\'');

		roomTopic = Object.keys(emoji.packages).reduce((topic, emojiPackage) => emoji.packages[emojiPackage].render(topic), roomTopic);

		// apostrophe (') back to &#39;
		return roomTopic.replace(/\'/g, '&#39;');
	},

	roomIcon() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!(roomData != null ? roomData.t : undefined)) { return ''; }

		return roomTypes.getIcon(roomData);
	},

	tokenAccessChannel() {
		return Template.instance().hasTokenpass.get();
	},
	encryptionState() {
		const room = ChatRoom.findOne(this._id);
		return settings.get('E2E_Enable') && room && room.encrypted && 'encrypted';
	},

	userStatus() {
		return getUserStatus(this._id) || 'offline';
	},

	userStatusText() {
		const statusText = getUserStatusText(this._id);
		if (statusText) {
			return statusText;
		}

		const presence = getUserStatus(this._id);
		if (presence) {
			return t(presence);
		}

		const oldStatusText = Template.instance().userOldStatusText.get();
		if (oldStatusText) {
			return oldStatusText;
		}

		return t('offline');
	},

	fixedHeight() {
		return Template.instance().data.fixedHeight;
	},

	fullpage() {
		return Template.instance().data.fullpage;
	},

	isChannel() {
		return Template.instance().currentChannel != null;
	},

	isSection() {
		return Template.instance().data.sectionName != null;
	},
	// added by yaoandw
	getNotAnsweredCnt() {
		return Template.instance().notAnsweredCnt.get();
	},
	showNotAnsweredCnt() {
		return Template.instance().notAnsweredCnt.get() > 0;
	},
	getNotice() {
		return Template.instance().notice.get();
	},
	showNotice() {
		return Template.instance().notice.get() != null && !Template.instance().notice.get().read;
	},
});

Template.headerRoom.events({
	'click .iframe-toolbar .js-iframe-action'(e) {
		fireGlobalEvent('click-toolbar-button', { id: this.id });
		e.currentTarget.querySelector('button').blur();
		return false;
	},

	'click .js-favorite'(event, instance) {
		event.stopPropagation();
		event.preventDefault();
		event.currentTarget.blur();

		return Meteor.call(
			'toggleFavorite',
			this._id,
			!instance.state.get('favorite'),
			(err) => err && handleError(err),
		);
	},

	'click .js-open-parent-channel'(event, t) {
		event.preventDefault();
		const { prid } = t.currentChannel;
		FlowRouter.goToRoomById(prid);
	},
	'click .js-toggle-encryption'(event) {
		event.stopPropagation();
		event.preventDefault();
		const room = ChatRoom.findOne(this._id);
		if (hasAllPermission('edit-room', this._id)) {
			call('saveRoomSettings', this._id, 'encrypted', !(room && room.encrypted)).then(() => {
				toastr.success(
					t('Encrypted_setting_changed_successfully'),
				);
			});
		}
	},
	'click .rc-header__content.rc-header__block'(event, instance) {
		const { tabBar } = instance.parentTemplate();
		const $flexTab = $('.flex-tab-container .flex-tab');

		if (tabBar.getState() === 'opened' && (tabBar.getTemplate() === 'channelSettings' || tabBar.getTemplate() === 'membersList')) {
			$flexTab.attr('template', '');
			return tabBar.close();
		}

		if (instance.currentChannel.t !== 'd') {
			$flexTab.attr('template', 'channelSettings');
			tabBar.setData({
				label: 'Room_Info',
				icon: 'info-circled',
			});
			tabBar.open(TabBar.getButton('channel-settings'));
		} else {
			$flexTab.attr('template', 'membersList');
			tabBar.setData({
				label: 'User_Info',
				icon: 'info-user',
			});
			tabBar.open(TabBar.getButton('user-info'));
		}
	},
	'click .ch_question'() {
		const query = `/pages/question/list?site=${ Meteor._localStorage.getItem('Cms.site') }&tn=${ Meteor._localStorage.getItem('Cms.token') }`;
		jumpToYitian(query);
	},
	'click .ch_preference'() {
		const query = `/pages/chat/chatPreference?site=${ Meteor._localStorage.getItem('Cms.site') }&tn=${ Meteor._localStorage.getItem('Cms.token') }`;
		jumpToYitian(query);
	},
	'click .ch_notice'() {
		const query = `${ Template.instance().notice.get().link }&tn=${ Meteor._localStorage.getItem('Cms.token') }`;
		setNoticeAsRead(() => {
			jumpToYitian(query);
		});
	},
});

const jumpToYitian = (query) => {
	const env = process.env.NODE_ENV;
	const wechatUniUrl = env === 'development' ? 'http://192.168.2.147:8081' : 'https://mp.cms.jojo.la';
	console.log(`query:${ query }`);
	// eslint-disable-next-line no-use-before-define
	if (isMiniProgram()) {
		/* eslint-disable*/
		let url = query;
		console.log(`url is ${ url },`);
		wx.miniProgram.navigateTo({
			// 跳转到登录页
			url: url,
			fail: (error) => {
				console.log('error；', error)
			}
		})
	} else {
		const redirectUrl = wechatUniUrl + query;
		console.log(`redirectUrl is ${ redirectUrl },`);
		location.href = redirectUrl;
	}
}

const isMiniProgram = () => {
	return (
		navigator.userAgent.match(/miniprogram/i) ||
		window.__wxjs_environment === 'miniprogram'
	)
};

const getCurrentUser = (success) => {
	HTTP.get(getApiUrl() + '/cms/api/cms/user/current', { headers: { authorization: Meteor._localStorage.getItem('Cms.token') } }, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			if (success) {
				success(result.data.data)
			}
		}
	});
}

const getUnansweredCount = (success) => {
	HTTP.post(getApiUrl() + '/cms/api/public/question/count', { headers: { authorization: Meteor._localStorage.getItem('Cms.token') }, data: { siteName: Meteor._localStorage.getItem('Cms.site'), answered: false } }, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			if (success) {
				success(result.data.data)
			}
		}
	});
}

const getLastNotice = (success) => {
	HTTP.post(getApiUrl() + '/cms-support/api/support/sys_notice/last', { headers: { authorization: Meteor._localStorage.getItem('Cms.token') }, data: { siteDomain: Meteor._localStorage.getItem('Cms.site') } }, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			if (success) {
				success(result.data?result.data.data:result.data)
			}
		}
	});
}

const setNoticeAsRead = (success) => {
	HTTP.post(getApiUrl() + '/cms-support/api/support/sys_notice/set_as_read', { headers: { authorization: Meteor._localStorage.getItem('Cms.token') }, data: { id: Template.instance().notice.get().id } }, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			if (success) {
				success(result.data?result.data.data:result.data)
			}
		}
	});
}

const getApiUrl = () => {
	const env = process.env.NODE_ENV;
	const apiUrl = env === 'development' ? 'http://192.168.2.147:5555' : 'https://server.cms.jojo.la';
	return apiUrl;
}






const loadUserStatusText = () => {
	const instance = Template.instance();

	if (!instance || !instance.data || !instance.data._id) {
		return;
	}

	const id = instance.data._id;

	if (Rooms.findOne(id).t !== 'd') {
		return;
	}

	const userId = getUidDirectMessage(id);

	// If the user is already on the local collection, the method call is not necessary
	const found = Meteor.users.findOne(userId, { fields: { _id: 1 } });
	if (found) {
		return;
	}

	Meteor.call('getUserStatusText', userId, (error, result) => {
		if (!error) {
			instance.userOldStatusText.set(result);
		}
	});
};

Template.headerRoom.onCreated(function() {
	this.state = new ReactiveDict();

	const isFavoritesEnabled = () => settings.get('Favorite_Rooms');

	const isDiscussion = (rid) => {
		const room = ChatRoom.findOne({ _id: rid });
		return !!(room && room.prid);
	};

	this.autorun(() => {
		const { _id: rid } = Template.currentData();

		this.state.set({
			rid,
			discussion: isDiscussion(rid),
		});

		if (!this.state.get('discussion') && isFavoritesEnabled()) {
			const subscription = ChatSubscription.findOne({ rid }, { fields: { f: 1 } });
			this.state.set('favorite', !!(subscription && subscription.f));
		} else {
			this.state.set('favorite', null);
		}
	});

	this.currentChannel = (this.data && this.data._id && Rooms.findOne(this.data._id)) || undefined;

	this.hasTokenpass = new ReactiveVar(false);
	this.userOldStatusText = new ReactiveVar(null);

	if (settings.get('API_Tokenpass_URL') !== '') {
		Meteor.call('getChannelTokenpass', this.data._id, (error, result) => {
			if (!error) {
				this.hasTokenpass.set(!!(result && result.tokens && result.tokens.length > 0));
			}
		});
	}

	loadUserStatusText();

	//added by yaoandw
	this.notAnsweredCnt = new ReactiveVar(0)
	getCurrentUser((user) => {
		if (user.roles.includes('doctor')) {
			getUnansweredCount((cnt) => {
				this.notAnsweredCnt.set(cnt)
			})
		}
	});

	this.notice = new ReactiveVar(null)
	getLastNotice((notice) => {
		this.notice.set(notice)
	});
});
