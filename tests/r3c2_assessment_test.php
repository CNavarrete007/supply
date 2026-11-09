<?php

declare(strict_types=1);
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeConflict.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeStale.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionCommercialAssessmentInput.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionCommercialInventory.php';

use App\Libraries\RequisitionCommercialAssessmentInput as Input;
use App\Libraries\RequisitionCommercialInventory as Inventory;
use App\Libraries\RequisitionChangeStale;

$passed=0;
function test_case(string $name,callable $callback):void
{
    global $passed;
    $callback();++$passed;echo "PASS $name\n";
}
function expectError(callable $f,string $exception=InvalidArgumentException::class):void
{
    try{$f();}catch(Throwable $e){if($e instanceof $exception)return;throw new RuntimeException('Wrong error: '.get_class($e));}
    throw new RuntimeException('Expected exception missing');
}
function fixture():array
{
    return ['assessment_version'=>0,'requisition_version'=>3,
        'inventory_sha256'=>str_repeat('a',64),'reason'=>'Revisar documento comercial relacionado',
        'treatments'=>[
            'rfqs'=>['action'=>'prepare_requote','reason'=>'Nueva propuesta RFQ','reference'=>'REF-100'],
            'purchase_orders'=>['action'=>'prepare_formal_amendment','reason'=>'Debe existir una enmienda formal','reference'=>null],
        ],'acknowledge_not_approval'=>true];
}
function inventory():array
{
    return ['inventory_sha256'=>str_repeat('a',64),'dependencies'=>[
        'rfqs'=>['count'=>2,'content_sha256'=>str_repeat('1',64)],
        'purchase_orders'=>['count'=>1,'content_sha256'=>str_repeat('2',64)],
        'supplier_quotes'=>['count'=>0,'content_sha256'=>str_repeat('3',64)],
    ]];
}

test_case('valid payload normalized',function(){
    $v=Input::payload(fixture());
    if($v['treatments']['rfqs']['action']!=='prepare_requote')throw new RuntimeException('wrong normalization');
    Input::matchInventory($v,inventory());
});
test_case('allowed actions',function(){foreach(Input::ACTIONS as $action){$p=fixture();$p['treatments']['rfqs']['action']=$action;
    if($action==='preserve_with_review')$p['treatments']['rfqs']['reference']='CHECK-01';Input::payload($p);}});
test_case('all inventory types explicit',function(){
    $v=Input::payload(fixture());$v['treatments']['customer_quotes']=['action'=>'manual_review','reason'=>'x','reference'=>null];
    expectError(fn()=>Input::matchInventory($v,inventory()));
});
test_case('missing impacted type rejected',function(){
    $v=Input::payload(fixture());unset($v['treatments']['purchase_orders']);
    expectError(fn()=>Input::matchInventory($v,inventory()));
});
test_case('inventory change detected',function(){
    $v=Input::payload(fixture());$i=inventory();$i['inventory_sha256']=str_repeat('b',64);
    expectError(fn()=>Input::matchInventory($v,$i),RequisitionChangeStale::class);
});
test_case('binary columns produce deterministic digest material',function(){
    $m=new ReflectionMethod(Inventory::class,'serializeRows');$input=[['id'=>'1','checksum'=>hex2bin('ff007f')]];
    $result=$m->invoke(null,$input);$obj=json_decode($result,true,512,JSON_THROW_ON_ERROR);
    if($obj[0]['checksum']['binary_sha256']!==hash('sha256',hex2bin('ff007f')))throw new RuntimeException('bad binary');
});
test_case('inventory allowed tables no duplicates',function(){
    if(count(Inventory::TABLES)!==count(array_unique(Inventory::TABLES))||count(Inventory::TABLES)!==13)
        throw new RuntimeException('table map drift');
});
test_case('order independent treatments',function(){
    $a=fixture();$b=$a;$b['treatments']=array_reverse($a['treatments'],true);
    if(Input::payload($a)!==Input::payload($b))throw new RuntimeException('noncanonical');
});
$errors=[
    'extra field'=>function(&$p){$p['force_apply']=true;},
    'missing assessment version'=>function(&$p){unset($p['assessment_version']);},
    'negative assessment version'=>function(&$p){$p['assessment_version']=-1;},
    'overflow assessment version'=>function(&$p){$p['assessment_version']=999999999;},
    'float assessment version'=>function(&$p){$p['assessment_version']=0.0;},
    'missing req version'=>function(&$p){unset($p['requisition_version']);},
    'zero req version'=>function(&$p){$p['requisition_version']=0;},
    'bad hash length'=>function(&$p){$p['inventory_sha256']='abcd';},
    'uppercase hash'=>function(&$p){$p['inventory_sha256']=str_repeat('A',64);},
    'ack absent'=>function(&$p){unset($p['acknowledge_not_approval']);},
    'ack false'=>function(&$p){$p['acknowledge_not_approval']=false;},
    'no reason'=>function(&$p){$p['reason']='';},
    'control char reason'=>function(&$p){$p['reason']="bad\x00";},
    'invalid utf8 reason'=>function(&$p){$p['reason']="\xff";},
    'reason too long'=>function(&$p){$p['reason']=str_repeat('x',4001);},
    'treatments missing'=>function(&$p){unset($p['treatments']);},
    'treatments empty'=>function(&$p){$p['treatments']=[];},
    'treatments list'=>function(&$p){$p['treatments']=[['action'=>'prepare_requote']];},
    'unknown treatment action'=>function(&$p){$p['treatments']['rfqs']['action']='approve_po';},
    'mutate command'=>function(&$p){$p['treatments']['rfqs']['apply_now']=true;},
    'unknown table key'=>function(&$p){$p['treatments']['x; DROP TABLE users']=['action'=>'manual_review','reason'=>'x'];},
    'invalid reference'=>function(&$p){$p['treatments']['rfqs']['reference']="x\x01";},
    'empty detail reason'=>function(&$p){$p['treatments']['rfqs']['reason']='';},
    'long detail reason'=>function(&$p){$p['treatments']['rfqs']['reason']=str_repeat('x',2001);},
    'preserve without reference'=>function(&$p){$p['treatments']['rfqs']['action']='preserve_with_review';$p['treatments']['rfqs']['reference']=null;},
];
foreach($errors as $name=>$edit){test_case($name,function()use($edit){$v=fixture();$edit($v);expectError(fn()=>Input::payload($v));});}
echo "R3C2 INPUT TESTS: $passed/".(8+count($errors))." PASS\n";
