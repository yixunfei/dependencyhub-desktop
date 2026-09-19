import { build } from 'esbuild'
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-terraform-verifier-'))
const outputFile = join(workDir, 'terraform-verifier.mjs')
const runner = String.raw`
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ManagerWorkspaceService } from './electron/services/managerWorkspace'
const roots=[]; const checks=[]; const assert=(v,m)=>{if(!v)throw new Error(m);checks.push(m)}
const fixture=async()=>{const cwd=await mkdtemp(join(tmpdir(),'dependencyhub-tf-'));roots.push(cwd);return cwd}
const main=async()=>{
 const cwd=await fixture()
 await writeFile(join(cwd,'main.tf'), 'terraform { required_providers { aws = { source = "hashicorp/aws" version = "~> 5.0" } } }\nmodule "vpc" { source = "terraform-aws-modules/vpc/aws" version = "5.8.1" }')
 await writeFile(join(cwd,'providers.tf.json'), JSON.stringify({terraform:{required_providers:{random:{source:'hashicorp/random',version:'3.6.0'}}},module:{network:{source:'example/network',version:'1.0.0'}}}))
 await writeFile(join(cwd,'.terraform.lock.hcl'), 'provider "registry.terraform.io/hashicorp/aws" {\n version = "5.40.0"\n constraints = "~> 5.0"\n hashes = ["h1:aws", "zh:aws"]\n}')
 const service=new ManagerWorkspaceService(); const descriptors=new Map(service.descriptors().map(d=>[d.managerId,d]));
 assert(descriptors.get('terraform')?.status==='preview','Terraform uses preview adapter'); assert(descriptors.get('opentofu')?.status==='preview','OpenTofu uses preview adapter'); assert(descriptors.get('terraform')?.capabilities.health===true,'Terraform exposes health')
 const inventory=await service.inventory(cwd,'terraform'); assert(inventory.some(i=>i.name==='aws'&&i.resolvedVersion==='5.40.0'),'Terraform merges provider lock'); assert(inventory.some(i=>i.name==='random'),'Terraform parses tf.json providers'); assert(inventory.some(i=>i.type==='module'),'Terraform inventories modules'); assert(inventory.some(i=>i.integrity==='h1:aws'),'Terraform preserves lock hash')
 for(const [op,command] of [['sync','terraform init'],['update','terraform init -upgrade'],['tree','terraform providers'],['list','terraform providers'],['lock','terraform providers lock'],['audit','terraform validate']]) { const p=await service.plan(cwd,'terraform',{operation:op}); assert(p.command===command, 'Terraform '+op+' command'); }
 const health=await service.health(cwd,'terraform'); assert(health.status!=='unavailable','Terraform health is available');
 const missing=await fixture(); await writeFile(join(missing,'main.tf'),'terraform {}'); const mh=await service.health(missing,'terraform'); assert(mh.findings.some(i=>i.id==='terraform-lock-missing'),'Terraform reports missing lock')
 const tofu=await service.inventory(cwd,'opentofu'); assert(tofu.some(i=>i.name==='aws'),'OpenTofu reuses inventory')
 console.log('Terraform manager verification passed ('+checks.length+' checks)')
}
try{await main()}finally{await Promise.all(roots.map(r=>rm(r,{recursive:true,force:true})))}
`
try { await build({stdin:{contents:runner,resolveDir:process.cwd(),sourcefile:'terraform-verifier.ts',loader:'ts'},outfile:outputFile,bundle:true,platform:'node',format:'esm',target:'node20',logLevel:'silent',banner:{js:"import { createRequire } from 'module'; const require = createRequire(import.meta.url);"},plugins:[{name:'tf-stubs',setup(api){api.onResolve({filter:/^\.\/(toolchain|commandRunner)$/},args=>args.importer.endsWith('extendedManager.ts')?{path:args.path,namespace:'tf-stub'}:undefined);api.onLoad({filter:/.*/,namespace:'tf-stub'},args=>args.path==='./toolchain'?{loader:'ts',contents:"export type ToolName=string; export async function resolveToolBin(tool:string){return tool;}"}:{loader:'js',contents:"export async function runLoggedCommand(){return {stdout:'',stderr:''}}"})}}]}); await import(pathToFileURL(outputFile).href) } finally { await rm(workDir,{recursive:true,force:true}) }
