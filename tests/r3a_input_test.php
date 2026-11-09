<?php

declare(strict_types=1);
require_once __DIR__.'/../backend/app/Libraries/RequisitionChangeInput.php';
require_once __DIR__.'/../backend/app/Libraries/RequisitionRecoveryInput.php';

use App\Libraries\RequisitionChangeInput;

$good=[
    'date'=>'2026-11-06','requested_by'=>'Cliente de prueba','source'=>'Correo del cliente',
    'change_type'=>'Cambio de cantidad','reference'=>'CR-TEST','reason'=>'Solicitud sintética de modificación',
    'header'=>['need_date'=>'2026-12-15'],
    'items'=>[['action'=>'modify','id'=>'123e4567-e89b-42d3-a456-426614174000',
        'description'=>'Elemento de prueba','quantity'=>'12.500','unit'=>'PZA','category'=>'Material']],
];
$cases=[];
$cases['valid_full']=[$good,true];
$cases['valid_header_only']=[array_replace($good,['items'=>[]]),true];
$cases['valid_items_only']=[array_replace($good,['header'=>[]]),true];
$cases['valid_cancel']=[array_replace($good,['items'=>[['action'=>'cancel','id'=>'123e4567-e89b-42d3-a456-426614174000']]]),true];
$cases['missing_reason']=[array_replace($good,['reason'=>'']),false];
$cases['missing_requester']=[array_replace($good,['requested_by'=>'']),false];
$cases['wrong_source']=[array_replace($good,['source'=>'Unverified']),false];
$cases['wrong_type']=[array_replace($good,['change_type'=>'Unknown']),false];
$cases['unsupported_add']=[array_replace($good,['change_type'=>'Agregar partida']),false];
$cases['no_changes']=[array_replace($good,['header'=>[],'items'=>[]]),false];
$cases['unknown_top_key']=[array_replace($good,['role'=>'admin']),false];
$cases['invalid_date']=[array_replace($good,['date'=>'2026-02-30']),false];
$cases['bad_header_field']=[array_replace($good,['header'=>['folio'=>'X']]),false];
$cases['blank_delivery']=[array_replace($good,['header'=>['delivery_place'=>'']]),false];
$cases['bad_item_id']=[array_replace($good,['items'=>[['action'=>'cancel','id'=>'not-a-uuid']]]),false];
$cases['bad_item_quantity']=[array_replace($good,['items'=>[array_replace($good['items'][0],['quantity'=>3])]]),false];
$cases['bad_item_category']=[array_replace($good,['items'=>[array_replace($good['items'][0],['category'=>''])]]),false];
$cases['extra_cancel_key']=[array_replace($good,['items'=>[['action'=>'cancel','id'=>'123e4567-e89b-42d3-a456-426614174000','quantity'=>'2']]]),false];
$cases['duplicate_item_id']=[array_replace($good,['items'=>[$good['items'][0],array_replace($good['items'][0],['id'=>strtoupper($good['items'][0]['id'])])]]),false];
$cases['unsupported_item_action']=[array_replace($good,['items'=>[['action'=>'add','id'=>'123e4567-e89b-42d3-a456-426614174000']]]),false];
$cases['control_in_reason']=[array_replace($good,['reason'=>"Invalid\x00reason"]),false];
$cases['no_json_object']=[['bad','list'],false];
$passed=0;
foreach($cases as $name=>[$data,$ok]){
    $actual=true;
    try{$r=RequisitionChangeInput::payload($data);if(!$r)$actual=false;}
    catch(InvalidArgumentException){$actual=false;}
    if($actual!==$ok){fwrite(STDERR,"FAIL $name expected=".($ok?'valid':'invalid')."\n");exit(1);}
    $passed++;
}
// Independent withdrawal contract cases.
foreach([['reason'=>'Cliente retiró solicitud'],['reason'=>''],['reason'=>"A\x02"],['reason'=>'OK','extra'=>1]] as $i=>$item){
    $valid=$i===0;$actual=true;
    try{RequisitionChangeInput::withdraw($item);}catch(InvalidArgumentException){$actual=false;}
    if($actual!==$valid){fwrite(STDERR,"FAIL withdraw_$i\n");exit(1);}$passed++;
}
// Ensure the supported response is normalized and no request identity is accepted in payload.
$r=RequisitionChangeInput::payload($good);
if($r['items'][0]['quantity']!=='12.500'||$r['date']!=='2026-11-06'||count($r['items'])!==1)exit(1);
$passed++;
echo "R3A INPUT TESTS: PASS ($passed/$passed)\n";
