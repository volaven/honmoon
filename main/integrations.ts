export function integrationConfigs(command:string,args:string[],env:Record<string,string>={}){
 const json=JSON.stringify({mcpServers:{honmoon:{command,args,...(Object.keys(env).length?{env}:{})}}},null,2);
 const toml=`[mcp_servers.honmoon]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\ntool_timeout_sec = 150\n${Object.keys(env).length?'\n[mcp_servers.honmoon.env]\n'+Object.entries(env).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n'):''}\n`;
 return {codex:toml,claude:json,antigravity:json};
}
