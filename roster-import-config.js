/* Versioned policies. Add a new profile instead of changing an existing profile. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MicuConfig = api;
})(globalThis, () => {
  const freeze = value => {
    if (value && typeof value === 'object') Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  const ruleProfiles = {
    'micu-v1': {
      id: 'micu-v1', label: '현재 MICU 기본 규칙',
      dutyCodes: {D:'D', E:'E', N:'N', NC:'N'},
      groupOrder: ['Charge', '중간년차', '저연차'],
      roles: {notification: '통보연락반', fire: '소화반', evacuation: '대피유도반'},
      notificationCount: 1, fireCount: 2,
      // Displayed shift spans include handover; automatic selection uses dutyStarts.
      dutyDisplay: {D:'07:00–15:30', E:'15:00–22:30', N:'22:00–07:30'},
      dutyStarts: {D:450, E:900, N:1320}
    }
  };
  const parserProfiles = {
    'legacy-monthly-v1': {
      id: 'legacy-monthly-v1', label: '기존 월간 근무표',
      // null means automatic detection; explicit overrides use zero-based indices.
      headerRow: null, nameColumn: null,
      namePattern: '^[가-힣]{2,4}$', ignoredNames: ['index'],
      groupBands: [{name:'Charge',count:8},{name:'중간년차',count:6},{name:'저연차',count:null}],
      nonWorkingCodes: ['OF','C','PE','V','NV'],
      maxRows: 2000, maxColumns: 200, maxFileBytes: 20 * 1024 * 1024
    }
  };
  return freeze({ruleProfiles, parserProfiles, activeRuleId:'micu-v1', activeParserId:'legacy-monthly-v1', legacyRuleId:'micu-v1'});
});
