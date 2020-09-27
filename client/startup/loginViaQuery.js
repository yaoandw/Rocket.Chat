import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';

Meteor.startup(() => {
	if (FlowRouter.getQueryParam('resumeToken')) {
		Meteor.loginWithToken(FlowRouter.getQueryParam('resumeToken'), () => {
			const token = FlowRouter.getQueryParam('tn');
			if (token) {
				Meteor._localStorage.setItem('Cms.token', token);
			}
			const site = FlowRouter.getQueryParam('site');
			if (site) {
				Meteor._localStorage.setItem('Cms.site', site);
			}
			if (FlowRouter.getQueryParam('path')) {
				FlowRouter.go(`/${ FlowRouter.getQueryParam('path') }`);
			} else {
				FlowRouter.go('/home');
			}
		});
	}
});
