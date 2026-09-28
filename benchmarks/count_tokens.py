import json, pathlib, statistics
import tiktoken
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'evidence/token-capture.json').read_text(encoding='utf-8'))
enc=tiktoken.get_encoding('o200k_base')
count=lambda value: len(enc.encode(value,disallowed_special=()))
tools=count(json.dumps(data['toolDefinitions'],ensure_ascii=False,separators=(',',':')))
rows=[]
for page in data['rows']:
    if 'error' in page:
        rows.append({'name':page['name'],'error':page['error']});continue
    samples=[{key:count(s[key]) for key in ['fullAX','interactiveAX','previousPayload','honmoonPayload']} for s in page['samples']]
    first=samples[0];warm=statistics.median(s['honmoonPayload'] for s in samples[1:])
    rows.append({'name':page['name'],'kind':page['kind'],'url':page['actualUrl'],'title':page['title'],'capabilities':page['capabilityCount'],'html':count(page['html']),'fullAX':first['fullAX'],'interactiveAX':first['interactiveAX'],'previousPayload':first['previousPayload'],'firstCapabilities':first['honmoonPayload'],'unchangedCapabilities':warm,'firstVsFullReduction':round(1-first['honmoonPayload']/max(1,first['fullAX']),4),'firstVsInteractiveReduction':round(1-first['honmoonPayload']/max(1,first['interactiveAX']),4),'threeCapturedObservations':{key:sum(sample[key] for sample in samples) for key in ['fullAX','interactiveAX','honmoonPayload']},'tenUnchangedObservations':{'fullAX':first['fullAX']*10,'interactiveAX':first['interactiveAX']*10,'honmoon':first['honmoonPayload']+9*warm,'honmoonIncludingToolDefinitionsOnce':tools+first['honmoonPayload']+9*warm}})
report={'at':data['at'],'encoding':'o200k_base','tokenizerVersion':tiktoken.__version__,'measurement':'Exact token counts under the specified encoding of captured text; not API billed usage or task completion benchmark.','honmoonToolDefinitionsOnce':tools,'rows':rows}
(root/'evidence/token-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
