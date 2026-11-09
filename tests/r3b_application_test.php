<?php

declare(strict_types=1);

use App\Libraries\RequisitionChangeApplication;
use App\Libraries\RequisitionChangeDecisionInput;

require_once __DIR__.'/../backend/app/Libraries/RequisitionRecoveryInput.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeConflict.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeStale.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeApplication.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeDecisionInput.php';

$total=0;
function check(bool $value,string $label):void{global $total;$total++;if(!$value)throw new RuntimeException('FAIL '.$label);}
function failure(callable $fn,string $label):void{
    try{$fn();}catch(\Throwable){check(true,$label);return;}
    throw new RuntimeException('Expected failure: '.$label);
}
$id1='11111111-1111-4111-8111-111111111111';
$id2='22222222-2222-4222-8222-222222222222';
$head=['need_date'=>'2026-11-20','delivery_place'=>'Sucursal'];
$items=[
 ['id'=>1,'public_id'=>$id1,'description'=>'A','quantity'=>'2.000000','unit_label'=>'PZA',
  'category_label_snapshot'=>'Materiales','line_status'=>'active','category_id'=>3,'unit_id'=>null],
 ['id'=>2,'public_id'=>$id2,'description'=>'B','quantity'=>'3.000000','unit_label'=>'PZA',
  'category_label_snapshot'=>'Materiales','line_status'=>'active','category_id'=>3,'unit_id'=>null],
];
function headerChange($field,$before,$after):array{return [
 'target_kind'=>'header','field_code'=>$field,'change_kind'=>'modify','snapshot_schema_version'=>1,'resolution_status'=>'proposed',
 'before_snapshot'=>json_encode(['value'=>$before]),'after_snapshot'=>json_encode(['value'=>$after])];}
function itemChange($dbId,$action,$prior,$next):array{return [
 'target_kind'=>'item','requisition_item_id'=>$dbId,'change_kind'=>$action,'snapshot_schema_version'=>1,
 'resolution_status'=>'proposed','before_snapshot'=>json_encode($prior),'after_snapshot'=>json_encode($next)];}
$before1=['id'=>$id1,'description'=>'A','quantity'=>'2.000000','unit'=>'PZA','category'=>'Materiales'];
$before2=['id'=>$id2,'description'=>'B','quantity'=>'3.000000','unit'=>'PZA','category'=>'Materiales'];
$patch=['id'=>$id1,'description'=>'A2','quantity'=>'2.50','unit'=>'PZA','category'=>'Materiales'];
$changes=[headerChange('need_date','2026-11-20','2026-12-05'),itemChange(1,'modify',$before1,$patch),
 itemChange(2,'cancel',$before2,['id'=>$id2,'status'=>'cancelled'])];
$r=RequisitionChangeApplication::plan($head,$items,$changes);
check($r['header']['need_date']==='2026-12-05','header date');
check(count($r['items'])===2,'two item actions');
check($r['items'][0]['patch']['quantity']==='2.50','quantity kept as decimal string');
check($r['items'][1]['patch']['line_status']==='cancelled','cancel no deletion');
check($r['active_after']===1,'one active line remains');
check(count($r['before'])===3,'all prior values preserved');
check(RequisitionChangeDecisionInput::payload(['decision'=>'approve','reason'=>'Revisión autorizada','requisition_version'=>3,'acknowledge_scope'=>true])['decision']==='approve','approval contract');
check(RequisitionChangeDecisionInput::payload(['decision'=>'reject','reason'=>'No corresponde'])['decision']==='reject','rejection contract');

failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'approve','reason'=>'Sí','requisition_version'=>1,'acknowledge_scope'=>false]),'no implicit acknowledgement');
failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'reject','reason'=>'No','requisition_version'=>1]),'no misleading requisition version for rejection');
failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'approve','reason'=>' ','requisition_version'=>1,'acknowledge_scope'=>true]),'reason required');
failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'approve','reason'=>'Sí','requisition_version'=>'1','acknowledge_scope'=>true]),'typed version');
failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'resubmit','reason'=>'Sí']), 'unapproved decision');
failure(fn()=>RequisitionChangeDecisionInput::payload(['decision'=>'reject','reason'=>'Sí','id'=>1]), 'no SQL-controlled keys');
failure(fn()=>RequisitionChangeApplication::plan(['need_date'=>'2026-11-21','delivery_place'=>'Sucursal'],$items,$changes),'stale header');
failure(fn()=>RequisitionChangeApplication::plan($head,[$items[1]],$changes),'missing item');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[headerChange('currency','MXN','USD')]),'unknown header field');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[headerChange('need_date','2026-11-20','2026-13-05')]),'bad date');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[headerChange('need_date','2026-11-20','2026-12-05'),headerChange('need_date','2026-11-20','2026-12-15')]),'duplicate header');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'modify',$before1,['id'=>$id1,'description'=>'A2','quantity'=>'0','unit'=>'PZA','category'=>'Materiales'])]),'nonpositive quantity');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'cancel',$before1,['id'=>$id1,'status'=>'cancelled']),itemChange(2,'cancel',$before2,['id'=>$id2,'status'=>'cancelled'])]),'cannot cancel all active');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'modify',['id'=>$id1,'description'=>'Tampered','quantity'=>'2.000000','unit'=>'PZA','category'=>'Materiales'],$patch)]),'before tampering');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'delete',$before1,['id'=>$id1,'status'=>'cancelled'])]),'unsupported action');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'modify',$before1,$before1)]),'unchanged item');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[]),'empty change list');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[array_merge($changes[0],['snapshot_schema_version'=>2])]),'unsupported schema');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[array_merge($changes[0],['resolution_status'=>'rejected'])]),'resolved proposal cannot apply');
failure(fn()=>RequisitionChangeApplication::plan($head,$items,[itemChange(1,'modify',$before1,['id'=>$id2,'description'=>'A2','quantity'=>'2.5','unit'=>'PZA','category'=>'Materiales'])]),'item swap');
print "R3B PURE INPUT/APPLICATION TESTS: $total/$total PASS\n";
