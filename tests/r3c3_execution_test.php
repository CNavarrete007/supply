<?php

declare(strict_types=1);
require __DIR__.'/../backend/app/Libraries/RequisitionRecoveryInput.php';
require __DIR__.'/../backend/app/Libraries/RequisitionChangeConflict.php';
require __DIR__.'/../backend/app/Libraries/RequisitionCommercialExecutionInput.php';
require __DIR__.'/../backend/app/Libraries/RequisitionCommercialExecutionRepository.php';

use App\Libraries\RequisitionCommercialExecutionInput as Input;
use App\Libraries\RequisitionCommercialExecutionRepository as Repo;
use App\Libraries\RequisitionChangeConflict;

$count=0;
function ok(bool $condition,string $message):void {global $count;$count++;if(!$condition)throw new RuntimeException('FAIL '.$count.': '.$message);}
function bad(callable $callback,string $message):void
{
    try{$callback();}catch(InvalidArgumentException|RequisitionChangeConflict $e){ok(true,$message);return;}
    ok(false,$message);
}
const DOC='11111111-1111-4111-8111-111111111111';
const NEXT='22222222-2222-4222-8222-222222222222';
const FILE_ID='33333333-3333-4333-8333-333333333333';
$base=['assessment_version'=>1,'requisition_version'=>2,'inventory_sha256'=>str_repeat('a',64),
    'document_kind'=>'supplier_quotes','document_id'=>DOC,'action'=>'supplier_confirmation_documented',
    'successor_id'=>null,'evidence_file_id'=>FILE_ID,'reference'=>'CONF-001',
    'reason'=>'Respuesta recibida con soporte verificable','acknowledge_no_document_mutation'=>true];
$valid=Input::record($base);
ok($valid['document_id']===DOC,'valid request');
ok($valid['successor_id']===null,'no successor for confirmation');
ok($valid['action']==='supplier_confirmation_documented','action normalized');
$actions=[
 ['rfqs','supplier_contact_documented',false],
 ['supplier_quotes','supplier_confirmation_documented',false],
 ['customer_quote_versions','client_confirmation_documented',false],
 ['customer_quote_versions','replacement_quote_verified',true],
 ['purchase_orders','formal_amendment_verified',true],
];
foreach($actions as [$kind,$action,$successor]){
 $p=$base;$p['document_kind']=$kind;$p['action']=$action;$p['successor_id']=$successor?NEXT:null;
 $out=Input::record($p);ok($out['action']===$action,'whitelisted action '.$action);
}
foreach([
 ['unexpected'=>'value'],['document_kind'=>'invoices'],['document_kind'=>'delivery_items'],
 ['document_kind'=>'purchase_orders','action'=>'client_confirmation_documented'],
 ['action'=>'formal_amendment_verified'],['document_id'=>'nope'],['evidence_file_id'=>'nope'],
 ['assessment_version'=>0],['requisition_version'=>0],['inventory_sha256'=>str_repeat('A',64)],
 ['inventory_sha256'=>'bad'],['acknowledge_no_document_mutation'=>false],['reference'=>''],
 ['reference'=>str_repeat('x',256)],['reason'=>"Invalid\0"],['reason'=>''],
 ['reason'=>str_repeat('x',2001)],['successor_id'=>NEXT],
 ] as $patch){bad(static fn()=>Input::record(array_replace($base,$patch)),'reject invalid '.json_encode($patch));}
$success=$base;$success['document_kind']='customer_quote_versions';$success['action']='replacement_quote_verified';
$success['successor_id']=NEXT;
ok(Input::record($success)['successor_id']===NEXT,'successor accepted');
bad(static fn()=>Input::record(array_replace($success,['successor_id'=>DOC])),'self-reference rejected');
bad(static fn()=>Input::record(array_replace($success,['successor_id'=>null])),'successor required');
$review=['assessment_version'=>1,'requisition_version'=>2,'inventory_sha256'=>str_repeat('a',64),
    'decision'=>'verified','reason'=>'Se verificó la evidencia y su vínculo','acknowledge_evidence_only'=>true];
ok(Input::review($review)['decision']==='verified','evidence verified');
ok(Input::review(array_replace($review,['decision'=>'rejected']))['decision']==='rejected','review rejected');
foreach([['decision'=>'approved'],['acknowledge_evidence_only'=>false],['reason'=>"bad\0"],
    ['assessment_version'=>0],['extra'=>'bad'],['reason'=>'']] as $patch){
 bad(static fn()=>Input::review(array_replace($review,$patch)),'bad review input');
}
foreach($actions as [$kind,$action]){
 $treatment=Input::ACTIONS[$kind][$action];
 Input::checkTreatment(['treatments'=>[$kind=>['action'=>$treatment]]],$kind,$action);
 ok(true,'assessment treatment compatible '.$action);
 bad(static fn()=>Input::checkTreatment(['treatments'=>[$kind=>['action'=>'escalate_manual_review']]],$kind,$action),'assessment mismatch '.$action);
}
$original=['id'=>100,'version_number'=>1,'customer_quote_id'=>7];
$quoted=['id'=>101,'version_number'=>2,'customer_quote_id'=>7,'supersedes_version_id'=>100,
    'change_request_id'=>17,'issued_at'=>'2026-11-06 00:00:00','locked_at'=>'2026-11-06 00:00:00',
    'approved_content_sha256'=>random_bytes(32)];
Repo::assertSuccessor('replacement_quote_verified',$original,$quoted,17);
ok(true,'linked issued quote');
foreach([
 ['version_number'=>3],['supersedes_version_id'=>99],['change_request_id'=>99],
 ['issued_at'=>null],['locked_at'=>null],['approved_content_sha256'=>null],['customer_quote_id'=>8],['id'=>100],
] as $patch){bad(static fn()=>Repo::assertSuccessor('replacement_quote_verified',$original,array_replace($quoted,$patch),17),'quote bad successor');}
bad(static fn()=>Repo::assertSuccessor('replacement_quote_verified',$original,null,17),'missing quote successor');
$po=['id'=>200,'version_number'=>1,'series_public_id'=>DOC,'supplier_id'=>11];
$newPo=['id'=>201,'version_number'=>2,'series_public_id'=>DOC,'supplier_id'=>11,
 'supersedes_purchase_order_id'=>200,'change_request_id'=>17,
 'authorized_at'=>'2026-11-06 00:00:00','locked_at'=>'2026-11-06 00:00:00',
 'approved_content_sha256'=>random_bytes(32)];
Repo::assertSuccessor('formal_amendment_verified',$po,$newPo,17);ok(true,'linked authorized PO');
foreach([
 ['version_number'=>4],['series_public_id'=>NEXT],['supplier_id'=>3],
 ['supersedes_purchase_order_id'=>123],['change_request_id'=>24],
 ['authorized_at'=>null],['locked_at'=>null],['approved_content_sha256'=>null]
] as $patch){bad(static fn()=>Repo::assertSuccessor('formal_amendment_verified',$po,array_replace($newPo,$patch),17),'reject broken PO');}
bad(static fn()=>Repo::assertSuccessor('formal_amendment_verified',$po,null,17),'missing PO successor');
Repo::assertSuccessor('supplier_confirmation_documented',$po,null,17);ok(true,'no successor allowed');
bad(static fn()=>Repo::assertSuccessor('supplier_confirmation_documented',$po,$newPo,17),'unexpected successor');
$binary="\xff\0bad";
ok(Repo::rowSha(['a'=>$binary])===Repo::rowSha(['a'=>$binary]),'binary stable');
ok(Repo::rowSha(['a'=>$binary])!==Repo::rowSha(['a'=>'bad']),'binary changes detected');
ok(Repo::rowSha(['a'=>'x'])!==Repo::rowSha(['a'=>'y']),'document edits detected');
echo "R3C3 pure validation and successor linkage PASS $count/$count\n";
