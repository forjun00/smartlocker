#pragma once
#include <Arduino.h>

struct Slot {
  int id;
  int relayPin;
  int doorPin;     // -1 = no sensor
};

extern const int  NUM_SLOTS;
extern const uint16_t PULSE_MS;
extern const bool RELAY_ACTIVE_HIGH;

extern Slot slots[];
extern bool relayOn[];
extern bool lockedState[];
extern bool doorClosed[];

void initSlots();
Slot* findSlotById(int id);
void  driveRelay(int idx, bool on);
void  pollDoors();

// MQTT-driven (publishes state back over MQTT)
void doLock(int idx);
void doUnlock(int idx);

// Pure local digitalWrite pulse — no MQTT, used by ESP web UI buttons
void manualPulse(int idx);
