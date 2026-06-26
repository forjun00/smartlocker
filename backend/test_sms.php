<?php





echo sendSMS('0647971041','ทดสอบ ส่ง SMS innos');
function sendSMS($phone, $message)
{
 $smsapi = "http://innovations.asefa.co.th/cdn/sms/";
 $post = [
  "phone" => $phone,
  "msg" => base64_encode($message)
 ];
 $ch = curl_init();
 curl_setopt($ch, CURLOPT_URL, $smsapi);
 curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
 curl_setopt($ch, CURLOPT_HEADER, 1);
 curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
 curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
 curl_setopt($ch, CURLOPT_POST, 1);
 curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
 $response  = curl_exec($ch);
 curl_close($ch);
  return $response;
}
?>