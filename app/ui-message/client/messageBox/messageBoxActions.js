import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { HTTP } from 'meteor/http';

import { VRecDialog } from '../../../ui-vrecord/client';
import { messageBox, modal } from '../../../ui-utils';
import { fileUpload } from '../../../ui';
import { settings } from '../../../settings';
import { t } from '../../../utils';
import { mime } from '../../../utils/lib/mimeTypes';
import { Users } from '../../../models/client/index';

messageBox.actions.add('Create_new', 'Video_message', {
	id: 'video-message',
	icon: 'video',
	condition: () => (navigator.mediaDevices || navigator.getUserMedia || navigator.webkitGetUserMedia
		|| navigator.mozGetUserMedia || navigator.msGetUserMedia)
		&& window.MediaRecorder
		&& settings.get('FileUpload_Enabled')
		&& settings.get('Message_VideoRecorderEnabled')
		&& (!settings.get('FileUpload_MediaTypeBlackList')
			|| !settings.get('FileUpload_MediaTypeBlackList').match(/video\/webm|video\/\*/i))
		&& (!settings.get('FileUpload_MediaTypeWhiteList')
			|| settings.get('FileUpload_MediaTypeWhiteList').match(/video\/webm|video\/\*/i)),
	action: ({ rid, tmid, messageBox }) => (VRecDialog.opened ? VRecDialog.close() : VRecDialog.open(messageBox, {
		rid,
		tmid,
	})),
});

messageBox.actions.add('Add_files_from', 'Computer', {
	id: 'file-upload',
	icon: 'computer',
	condition: () => settings.get('FileUpload_Enabled'),
	action({ rid, tmid, event, messageBox }) {
		event.preventDefault();
		const $input = $(document.createElement('input'));
		$input.css('display', 'none');
		$input.attr({
			id: 'fileupload-input',
			type: 'file',
			multiple: 'multiple',
		});

		$(document.body).append($input);

		$input.one('change', function(e) {
			const filesToUpload = [...e.target.files].map((file) => {
				Object.defineProperty(file, 'type', {
					value: mime.lookup(file.name),
				});
				return {
					file,
					name: file.name,
				};
			});

			fileUpload(filesToUpload, $('.js-input-message', messageBox).get(0), { rid, tmid });
			$input.remove();
		});

		$input.click();

		// Simple hack for iOS aka codegueira
		if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
			$input.click();
		}
	},
});

// added by yaoandw start
messageBox.actions.add('收集问题', '收集', {
	id: 'forward-message',
	icon: 'quote',
	condition: () => {
		const userId = Meteor.userId(); // Meteor._localStorage.getItem('Meteor.userId');
		return Users.isUserInRole(userId, 'admin') || Users.isUserInRole(userId, 'assistant');
	},
	action({ replies }) {
		const replyIds = replies.map(({ _id }) => _id);
		console.log(`replies:${ JSON.stringify(replies) },replyIds:${ JSON.stringify(replyIds) },userId:${ Meteor.userId() }`);
		// HTTP.post('https://server.cms.jojo.la/cms/api/public/article/main', { data: { siteName: 'siteadmin' } }, (error, result) => {
		// 	console.log(result);
		// 	console.log(error);
		// });
		const env = process.env.NODE_ENV;
		const wechatUniUrl = env === 'development' ? 'http://192.168.2.147:8081' : 'https://mp.cms.jojo.la';
		const query = `/pages/question/question?replies=${ replyIds.join() }&user=${ Meteor.userId() }&tn=${ Meteor._localStorage.getItem('Cms.token') }`;
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
	},
});
const isMiniProgram = () => {
	return (
		navigator.userAgent.match(/miniprogram/i) ||
		window.__wxjs_environment === 'miniprogram'
	)
};
// added end

const canGetGeolocation = new ReactiveVar(false);

const getGeolocationPermission = () => new Promise((resolve) => {
	if (!navigator.permissions) {
		resolve(true);
	}
	navigator.permissions.query({ name: 'geolocation' }).then(({ state }) => {
		resolve(state);
	});
});

const getGeolocationPosition = () => new Promise((resolvePos) => {
	navigator.geolocation.getCurrentPosition(resolvePos, () => {
		resolvePos(false);
	}, {
		enableHighAccuracy: true,
		maximumAge: 0,
		timeout: 10000,
	});
});

const getCoordinates = async () => {
	const status = await getGeolocationPermission();
	if (status === 'prompt') {
		let resolveModal;
		const modalAnswer = new Promise((resolve) => {
			resolveModal = resolve;
		});
		modal.open({
			title: t('You_will_be_asked_for_permissions'),
			confirmButtonText: t('Continue'),
			showCancelButton: true,
			closeOnConfirm: true,
			closeOnCancel: true,
		}, async (isConfirm) => {
			if (!isConfirm) {
				resolveModal(false);
			}
			const position = await getGeolocationPosition();
			if (!position) {
				const newStatus = getGeolocationPermission();
				resolveModal(newStatus);
			}
			resolveModal(position);
		});
		const position = await modalAnswer;
		return position;
	}

	if (status === 'denied') {
		return status;
	}

	const position = await getGeolocationPosition();
	return position;
};


messageBox.actions.add('Share', 'My_location', {
	id: 'share-location',
	icon: 'map-pin',
	condition: () => canGetGeolocation.get(),
	async action({ rid, tmid }) {
		const position = await getCoordinates();

		if (!position) {
			return;
		}

		if (position === 'denied') {
			modal.open({
				title: t('Cannot_share_your_location'),
				text: t('The_necessary_browser_permissions_for_location_sharing_are_not_granted'),
				confirmButtonText: t('Ok'),
				closeOnConfirm: true,
			});
			return;
		}

		const { coords: { latitude, longitude } } = position;
		const text = `<div class="upload-preview"><div class="upload-preview-file" style="background-size: cover; box-shadow: 0 0 0px 1px #dfdfdf; border-radius: 2px; height: 250px; width:100%; max-width: 500px; background-image:url(https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=500x250&markers=color:gray%7Clabel:%7C${ latitude },${ longitude }&key=${ settings.get('MapView_GMapsAPIKey') })" ></div></div>`;

		modal.open({
			title: t('Share_Location_Title'),
			text,
			showCancelButton: true,
			closeOnConfirm: true,
			closeOnCancel: true,
			html: true,
		}, function(isConfirm) {
			if (isConfirm !== true) {
				return;
			}
			Meteor.call('sendMessage', {
				_id: Random.id(),
				rid,
				tmid,
				msg: '',
				location: {
					type: 'Point',
					coordinates: [longitude, latitude],
				},
			});
		});
	},
});

Meteor.startup(() => {
	Tracker.autorun(() => {
		const isMapViewEnabled = settings.get('MapView_Enabled') === true;
		const isGeolocationCurrentPositionSupported = navigator.geolocation && navigator.geolocation.getCurrentPosition;
		const googleMapsApiKey = settings.get('MapView_GMapsAPIKey');
		canGetGeolocation.set(isMapViewEnabled && isGeolocationCurrentPositionSupported && googleMapsApiKey && googleMapsApiKey.length);
	});
});
