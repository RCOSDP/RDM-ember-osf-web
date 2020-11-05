
export default {
  name: 'i18n',
  initialize: function(app) {
    let i18n = app.lookup('service:i18n');
    
    i18n.addTranslations('ja-jp');
    i18n.set('locale', calculateLocale(i18n.get('locales')));
  }
}

function calculateLocale(locales) {
  // whatever you do to pick a locale for the user:
  var defaultLanguage = 'en';
  const language = navigator.languages ? navigator.languages[0] : ( navigator.language || navigator.userLanguage || defaultLanguage);

  var fallbackCode = language.split('-')[0];

  return locales.includes(language.toLowerCase()) ? language : fallbackCode;
}

