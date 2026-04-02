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
declare class Jouwloon {
    private cookies;
    private klantendata;
    private ready;
    static create(username: string, password: string): Promise<Jouwloon>;
    login(username: string, password: string): Promise<this>;
    private bootstrap;
    private buildHeaders;
    private storeCookies;
    private getCookieHeader;
    private getRequiredInputValue;
    getCalendar: (start: Date, end: Date, options?: {
        timeZone?: string;
    }) => Promise<KalenderResponse>;
    private requireLogin;
    private formatDate;
}
export { Jouwloon };
