import { parse } from 'node-html-parser';

const BASE_URL = 'https://jouwloon.nl';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'X-MicrosoftAjax': 'Delta=true',
  'X-Requested-With': 'XMLHttpRequest',
};

type Klantendata = { vestiging: [{ vestId: string | undefined }] }[];
type VestigingResponse = Array<{ VestigingsID?: string }>;
type KalenderKlantendata = Array<{ vestigingen: Array<{ vestId: string }> }>;
type KalendarAPIResponse = Array<{
  id: string;
  roosterdienst: [
    {
      vestiging: number;
      vanafDatum: string;
      totDatum: string;
      klant?: number;
      afdeling?: string;
      weergeven?: boolean;
      afkorting?: string;
      isCollega?: any;
      classNaam?: string;
    },
  ];
}>;
type KalenderResponse = Array<{
  id: string;
  vestiging: number;
  start: Date;
  end: Date;
  klant?: number | undefined;
  afdeling?: string | undefined;
  weergeven?: boolean | undefined;
  afkorting?: string | undefined;
  isCollega?: any;
  classNaam?: string | undefined;
}>;

class Jouwloon {
  private cookies = new Map<string, string>();
  private klantendata: KalenderKlantendata = [];
  private ready: Promise<void> | null = null;

  static async create(username: string, password: string): Promise<Jouwloon> {
    const client = new Jouwloon();
    return client.login(username, password);
  }

  async login(username: string, password: string): Promise<this> {
    this.cookies.clear();
    this.klantendata = [];
    this.ready = this.bootstrap(username, password);
    await this.ready;
    return this;
  }

  private async bootstrap(username: string, password: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_URL}/Login.aspx`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      this.storeCookies(response);

      const html = await response.text();
      const root = parse(html);

      const viewstate = this.getRequiredInputValue(root, '#__VIEWSTATE');
      const viewstateGenerator = this.getRequiredInputValue(
        root,
        '#__VIEWSTATEGENERATOR',
      );
      const eventValidation = this.getRequiredInputValue(
        root,
        '#__EVENTVALIDATION',
      );

      const loginRequestData = {
        ctl00$scriptmanager:
          'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$Button_Inloggen',
        __EVENTTARGET: '',
        __EVENTARGUMENT: '',
        __VIEWSTATE: viewstate,
        __VIEWSTATEGENERATOR: viewstateGenerator,
        __EVENTVALIDATION: eventValidation,
        ctl00$AppGebruiker: '',
        ctl00$Versie: '',
        ctl00$ContentPlaceHolder1$HiddenTaal: 'Nederlands',
        ctl00$ContentPlaceHolder1$input_Gebruikersnaam: username,
        ctl00$ContentPlaceHolder1$input_Wachtwoord: password,
        ctl00$ContentPlaceHolder1$devtype: '0',
        ctl00$ContentPlaceHolder1$devverz: '0',
        __ASYNCPOST: 'true',
        ctl00$ContentPlaceHolder1$Button_Inloggen: 'Inloggen',
      };

      const loginResponse = await fetch(`${BASE_URL}/Login.aspx`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: new URLSearchParams(loginRequestData).toString(),
      });
      this.storeCookies(loginResponse);

      if (!loginResponse.ok) {
        throw new Error(
          `Login failed with status ${loginResponse.status} ${loginResponse.statusText}`,
        );
      }

      const klantendataResponse = await fetch(
        `${BASE_URL}/api/rooster/GetRoosterVestigingen`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        },
      );

      if (!klantendataResponse.ok) {
        throw new Error(
          `Failed to load klantendata with status ${klantendataResponse.status} ${klantendataResponse.statusText}`,
        );
      }

      const vestigingen =
        (await klantendataResponse.json()) as VestigingResponse;
      const vestigingId = vestigingen[0]?.VestigingsID;

      if (!vestigingId) {
        throw new Error('No VestigingsID returned for authenticated user');
      }

      this.klantendata = [
        {
          vestigingen: [{ vestId: vestigingId }],
        },
      ];
    } catch (error) {
      throw new Error(
        `Failed to retrieve session cookie from Jouwloon: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    const cookieHeader = this.getCookieHeader();

    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }

    return headers;
  }

  private storeCookies(response: Response): void {
    for (const setCookieHeader of response.headers.getSetCookie()) {
      const cookie = setCookieHeader.split(';', 1)[0];

      if (!cookie) {
        continue;
      }

      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);

      this.cookies.set(name, value);
    }
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private getRequiredInputValue(
    root: ReturnType<typeof parse>,
    selector: string,
  ): string {
    const element = root.querySelector(selector);

    if (!element) {
      throw new Error(`Missing required input: ${selector}`);
    }

    const value = element.getAttribute('value');

    if (!value) {
      throw new Error(`Missing value for input: ${selector}`);
    }

    return value;
  }

  getCalendar = async (
    start: Date,
    end: Date,
    options?: { timeZone?: string },
  ) => {
    await this.requireLogin();

    const requestBody = {
      klantenData: JSON.stringify(this.klantendata),
      start: this.formatDate(start),
      end: this.formatDate(end),
      timeZone: options?.timeZone ?? 'Europe/Amsterdam',
    };

    const urlEncodedBody = Object.entries(requestBody)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');

    const response = await fetch(`${BASE_URL}/api/rooster/GetKalender`, {
      method: 'POST',
      body: urlEncodedBody,
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load calendar with status ${response.status} ${response.statusText}`,
      );
    }

    const kalendar: KalendarAPIResponse = await response.json();

    const shifts: KalenderResponse = [];

    for (const shift of kalendar) {
      shifts.push({
        id: shift.id,
        vestiging: shift.roosterdienst[0].vestiging,
        start: new Date(shift.roosterdienst[0].vanafDatum),
        end: new Date(shift.roosterdienst[0].totDatum),

        klant: shift.roosterdienst[0].klant,
        afdeling: shift.roosterdienst[0].afdeling,
        weergeven: shift.roosterdienst[0].weergeven,
        afkorting: shift.roosterdienst[0].afkorting,
        isCollega: shift.roosterdienst[0].isCollega,
        classNaam: shift.roosterdienst[0].classNaam,
      });
    }

    return shifts;
  };

  private async requireLogin(): Promise<void> {
    if (!this.ready) {
      throw new Error('Call login() before calling getCalendar().');
    }

    await this.ready;
  }

  private formatDate(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds(),
    )}`;
  }
}

export { Jouwloon };
