#pragma once
#include <Arduino.h>
#include <PubSubClient.h>

extern PubSubClient mqtt;
extern bool apMode;

bool connectWiFi(uint32_t timeoutMs = 15000);
void startAP();
void serviceWiFi();          // call from loop()

void connectMQTT();
void serviceMQTT();          // call from loop()
void publishState(int idx, bool retain = true);
void publishDoor (int idx, bool retain = true);

String topicBase();
String slotTopic(int id, const char* leaf);
