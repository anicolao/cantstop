export type Preferences={view:'standard'|'overhead'|'tabletop';animationSpeed:'standard'|'fast'|'blazing'};
export const RATES={standard:1,fast:2,blazing:4} as const;
export const DEFAULTS:Preferences={view:'standard',animationSpeed:'standard'};
export const SETTINGS_KEY='cantstop:settings:v1';
export function normalizePreferences(value:unknown):Preferences{
 const p=value&&typeof value==='object'?value as Partial<Preferences>:{};
 return {view:p.view==='overhead'?'overhead':p.view==='tabletop'?'tabletop':'standard',animationSpeed:p.animationSpeed&&Object.hasOwn(RATES,p.animationSpeed)?p.animationSpeed:'standard'};
}
