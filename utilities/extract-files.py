import json,os,sys

filename = sys.argv[1]
file_path = "../build/contracts/"+filename
content = open(file_path, "r").read()
object = json.loads(content)

abi = json.dumps(object['abi'], indent=2)
bin = object['bytecode'][2:]

open(filename+".abi","w").write(abi)
open(filename+".bin","w").write(bin)

