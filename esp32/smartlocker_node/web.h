#pragma once
#include <Arduino.h>
#include <WebServer.h>

extern WebServer http;
extern unsigned long bootMs;

void setupWeb();
void serviceWeb();
