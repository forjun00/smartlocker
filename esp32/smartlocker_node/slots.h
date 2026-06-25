#pragma once
#include <Arduino.h>

struct Slot {
  int id;
  int relayPin;
  int doorPin;     // -1 = no sensor
  int ledPin;      // -1 = no LED
};

constexpr int MAX_SLOTS = 16;

extern const uint16_t PULSE_MS;
extern const bool     RELAY_ACTIVE_HIGH;
extern const bool     LED_ACTIVE_HIGH;   // true = HIGH lights the LED

extern int  slotCount;
extern Slot slots[MAX_SLOTS];
extern bool relayOn[MAX_SLOTS];
extern bool lockedState[MAX_SLOTS];
extern bool doorClosed[MAX_SLOTS];

// Defaults applied the first time the device boots (or after a clear).
extern const int DEFAULT_SLOT_COUNT;
extern const int DEFAULT_RELAY_PINS[MAX_SLOTS];
extern const int DEFAULT_LED_PINS[MAX_SLOTS];   // -1 = LED off until configured

// NVS persistence for the GPIO mapping.
void loadSlotMapping();
void saveSlotMapping();

void initSlots();
Slot* findSlotById(int id);
void  driveRelay(int idx, bool on);
void  driveLed(int idx);     // LED on when slot empty, off when a parcel is locked in
void  pollDoors();

// MQTT-driven (publishes state back over MQTT)
void doLock(int idx);
void doUnlock(int idx);

// Pure local digitalWrite pulse — no MQTT, used by ESP web UI buttons
void manualPulse(int idx);

inline int slotCountValue() { return slotCount; }   // for non-slots code
