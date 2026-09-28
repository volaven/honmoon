export function codexEnvironment(home:string,source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv{
 const env={...source};
 // An app launched by Codex must not inherit the parent thread's desktop tools pipe.
 for(const key of Object.keys(env))if(key.startsWith('CODEX_'))delete env[key];
 return {...env,CODEX_HOME:home};
}
