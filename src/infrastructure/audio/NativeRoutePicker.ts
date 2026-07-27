import { NativeModules, Platform } from 'react-native';
import { RoutePicker } from '@core/ports';

/** Native modülün JS tarafındaki yüzeyi. */
interface AirPlayRoutePickerModule {
  present(): void;
}

/**
 * NativeRoutePicker — RoutePicker portunun iOS implementasyonu.
 *
 * `ios/AACP/AirPlayRoutePicker.swift` içindeki native modülü çağırır; o da
 * sistem `AVRoutePickerView` panelini açar. Modül yoksa (Android ya da pod
 * kurulmamış bir iOS build'i) `available` false döner ve UI düğmeyi
 * pasifleştirir — uygulama çalışmaya devam eder.
 */
export class NativeRoutePicker implements RoutePicker {
  private readonly module?: AirPlayRoutePickerModule;

  constructor() {
    // Yalnızca iOS'ta anlamlı; diğer platformlarda modül aranmaz bile.
    this.module =
      Platform.OS === 'ios'
        ? (NativeModules.AirPlayRoutePicker as AirPlayRoutePickerModule | undefined)
        : undefined;
  }

  get available(): boolean {
    return typeof this.module?.present === 'function';
  }

  present(): void {
    this.module?.present();
  }
}
