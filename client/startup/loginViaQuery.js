import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';

Meteor.startup(() => {
	if (FlowRouter.getQueryParam('resumeToken')) {
		Meteor.loginWithToken(FlowRouter.getQueryParam('resumeToken'), () => {
			if (FlowRouter.getQueryParam('path')) {
				FlowRouter.go(`/${ FlowRouter.getQueryParam('path') }`);
			} else {
				FlowRouter.go('/home');
			}
		});
	}
});
