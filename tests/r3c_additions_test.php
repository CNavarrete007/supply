<?php

declare(strict_types=1);

use App\Libraries\RequisitionChangeInput;
use App\Libraries\RequisitionChangeApplication;
use App\Libraries\RequisitionChangeConflict;

foreach(['RequisitionRecoveryInput','RequisitionChangeConflict','RequisitionChangeStale',
    'RequisitionChangeInput','RequisitionChangeApplication'] as $name){
    require_once __DIR__.'/../backend/app/Libraries/'.$name.'.php';
}

$count=0;
function ok(bool $pass,string $reason):void{
    global $count;
    if(!$pass)throw new RuntimeException('FAILED '.$reason);
    $count++;
}
function blocked(callable $action,string $reason):void{
    try{$action();}
    catch(\InvalidArgumentException|RequisitionChangeConflict|\App\Libraries\RequisitionChangeStale){ok(true,$reason);return;}
    throw new RuntimeException('NOT BLOCKED '.$reason);
}
$existing='11111111-1111-4111-8111-111111111111';
$new='22222222-2222-4222-8222-222222222222';
$otherNew='33333333-3333-4333-8333-333333333333';
$base=['date'=>'2026-11-06','requested_by'=>'Solicitante','source'=>'Correo del cliente',
    'change_type'=>'Agregar partida','reference'=>'CORR-01','reason'=>'Añadir material necesario',
    'items'=>[['action'=>'add','description'=>'Válvula industrial','quantity'=>'2.250000','unit'=>'PZA','category'=>'Materiales']]];
$parsed=RequisitionChangeInput::payload($base);
ok(count($parsed['items'])===1,'one addition parsed');
ok($parsed['items'][0]['action']==='add','action retained');
ok(!array_key_exists('id',$parsed['items'][0]),'no client-controlled public id');
ok($parsed['items'][0]['quantity']==='2.250000','decimal stays a string');
$base2=$base;$base2['change_type']='Cambio de alcance';
ok(count(RequisitionChangeInput::payload($base2)['items'])===1,'mixed scope allows add');
$base3=$base;$base3['header']=['need_date'=>'2026-11-30'];
ok(count(RequisitionChangeInput::payload($base3)['header'])===1,'header allowed with addition');
$base4=$base;$base4['items'][]=['action'=>'cancel','id'=>$existing];
ok(count(RequisitionChangeInput::payload($base4)['items'])===2,'add and cancel proposal');
$invalid=$base;$invalid['items'][0]['id']=$new;
blocked(fn()=>RequisitionChangeInput::payload($invalid),'client supplied new public id denied');
$invalid=$base;$invalid['items'][0]['quantity']='0';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'zero new quantity denied');
$invalid=$base;$invalid['items'][0]['quantity']='1e8';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'scientific qty denied');
$invalid=$base;$invalid['items'][0]['description']='   ';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'blank description denied');
$invalid=$base;$invalid['items'][0]['category']='';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'blank category denied');
$invalid=$base;$invalid['items'][0]['unit']='';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'blank unit denied');
$invalid=$base;$invalid['items'][0]['category']='Materiales';$invalid['items'][0]['mystery']='1';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'unknown add field denied');
$invalid=$base;$invalid['change_type']='Cambio de cantidad';
blocked(fn()=>RequisitionChangeInput::payload($invalid),'mislabeled addition denied');
$invalid=$base;$invalid['change_type']='Agregar partida';$invalid['items']=[['action'=>'cancel','id'=>$existing]];
blocked(fn()=>RequisitionChangeInput::payload($invalid),'add type requires addition');
$invalid=$base;$invalid['items']=array_fill(0,21,$base['items'][0]);
blocked(fn()=>RequisitionChangeInput::payload($invalid),'excess additions denied');
$head=['need_date'=>'2026-11-20','delivery_place'=>'Sucursal'];
$items=[['id'=>1,'public_id'=>$existing,'line_number'=>1,'description'=>'Anillo',
    'quantity'=>'1.000000','unit_label'=>'PZA','category_label_snapshot'=>'Materiales','line_status'=>'active']];
function addition(string $id,int $dbId=51):array{
    return ['id'=>$dbId,'target_kind'=>'item','requisition_item_id'=>null,'field_code'=>null,'change_kind'=>'add',
        'requires_sourcing'=>1,'before_snapshot'=>json_encode(['status'=>'not_created']),
        'after_snapshot'=>json_encode(['id'=>$id,'description'=>'Válvula industrial','quantity'=>'2.250000',
            'unit'=>'PZA','category'=>'Materiales']),
        'snapshot_schema_version'=>2,'resolution_status'=>'proposed'];
}
$plan=RequisitionChangeApplication::plan($head,$items,[addition($new)]);
ok(count($plan['items'])===1,'single insert plan');
ok($plan['items'][0]['action']==='add','plan action add');
ok($plan['items'][0]['change_item_id']===51,'persisted change item linked');
ok($plan['items'][0]['db_id']===null,'new item has no preexisting db id');
ok($plan['items'][0]['public_id']===$new,'new public id stored');
ok($plan['items'][0]['patch']['quantity']==='2.250000','new decimal retained');
ok($plan['active_after']===2,'active after add');
ok($plan['before'][0]['item']['status']==='not_created','no invented history');
// Old R3B modify combined with R3C new line.
$changeOld=['target_kind'=>'item','requisition_item_id'=>1,'change_kind'=>'cancel',
    'before_snapshot'=>json_encode(['id'=>$existing,'description'=>'Anillo','quantity'=>'1.000000','unit'=>'PZA','category'=>'Materiales']),
    'after_snapshot'=>json_encode(['id'=>$existing,'status'=>'cancelled']),
    'snapshot_schema_version'=>1,'resolution_status'=>'proposed'];
$p=RequisitionChangeApplication::plan($head,$items,[$changeOld,addition($new)]);
ok($p['active_after']===1,'cancel plus add leaves one active');
ok(count($p['items'])===2,'mixed change plan preserved');
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[addition($new),addition($new,52)]),'same new uuid twice');
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[addition($existing)]),'existing uuid reused');
$bad=addition($new);$bad['snapshot_schema_version']=1;
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'no R3A add masquerade');
$bad=addition($new);$bad['requisition_item_id']=1;
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'new item must not reference old row');
$bad=addition($new);$bad['field_code']='need_date';
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'new item must not be header');
$bad=addition($new);$bad['before_snapshot']=json_encode(['status'=>'existing']);
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'fabricated before denied');
$bad=addition($new);$bad['after_snapshot']=json_encode(['id'=>$new,'description'=>'New','quantity'=>'0',
  'unit'=>'PZA','category'=>'Materiales']);
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'zero new quantity in stored snapshot');
$bad=addition($new);$bad['after_snapshot']=json_encode(['id'=>$new,'description'=>'Válvula','quantity'=>'2',
  'unit'=>'PZA','category'=>'Materiales','unit_price'=>'200000']);
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'no commercial price injected');
$bad=addition($new);$bad['requires_sourcing']=0;
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'new item requires sourcing');
$bad=addition($new);$bad['id']=null;
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'missing persisted change record id');
$bad=addition($new);$bad['resolution_status']='rejected';
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'resolved add cannot apply');
$bad=addition($new);$bad['after_snapshot']='not-json';
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'malformed after snapshot denied');
$bad=addition($otherNew);$bad['target_kind']='header';
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'add cannot be header');
$bad=addition($new);$bad['snapshot_schema_version']=3;
blocked(fn()=>RequisitionChangeApplication::plan($head,$items,[$bad]),'unrecognized add schema denied');
print "R3C ADDITIONS PURE TESTS: {$count}/{$count} PASS\n";
