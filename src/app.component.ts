import { NgModule, OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { HttpModule, Headers, Http, RequestOptions } from '@angular/http';
import { BrowserModule } from '@angular/platform-browser';
import { ElectronService, NgxElectronModule } from 'ngx-electron';
import { Observable } from 'rxjs/Rx';

@Component({
  selector: 'App',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private opArgs: any = {};

  public parmsValid: boolean = true;
  public uploadIsEnabled: boolean = false;
  public printIsEnabled: boolean = false;
  public removeIsEnabled: boolean = false;
  public removeSource: boolean = true;
  public status: string = 'Loading...';
  public fs: any;
  //-p=D:\Users\John\Desktop -f=Bed_Mount.gcode -s=http://192.168.1.123/ -a=929780E72D6447649F5F1123AC3C32A7
  constructor(private es: ElectronService, private http: Http) {
    this.opArgs.Host = 'http://192.168.1.123';
    this.opArgs.Path = 'D:\\Users\\John\\Desktop\\';
    this.opArgs.FileName = 'Bed_Mount.gcode';
    this.opArgs.ApiKey = '16BA8F2236DD4C48BDC0CFFFA556BF2B';
  }

  ngOnInit(): void {
    try {
      this.status = 'Loading File...';
      this.fs = this.es.remote.require('fs');
      this.opArgs.File = new Blob([this.fs.readFileSync(this.opArgs.Path + this.opArgs.FileName, 'utf8')], { type: 'application/octet-stream' });
    } catch (err) {
      this.status = 'File could not be read.';
      return;
    }

    this.status = 'File loaded, Getting OctiPrint Status...';
    this.getState().subscribe((result) => this.onSuccessfulGetState(result),
      (errors: any) => this.onUnsuccessful(errors)
    );
  }

  getState(): Observable<any> {
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-Api-Key', this.opArgs.ApiKey);
    let requestOptions = new RequestOptions({ headers: headers });
    return this.http.get(this.opArgs.Host + '/api/job', requestOptions).map((res: Response) => res.json());
  }

  onSuccessfulGetState(result): void {
    let state = result.state;
    console.log(this.uploadIsEnabled);
    if (state === 'Operational') {
      this.uploadIsEnabled = true;
      this.printIsEnabled = true;
      this.removeIsEnabled = true;
      this.status = 'OctoPrint is ready to start printing.';
    } else if (state === 'Printing') {
      this.uploadIsEnabled = true;
      this.printIsEnabled = false;
      this.removeIsEnabled = true;
      this.status = 'OctoPrint is currently printing.';
    } else {
      this.status = 'OctoPrint is offline or there is a invalid parameter.';
    }

    console.log(this.uploadIsEnabled);
  }

  pushFile(startPrint: boolean) {
    this.postFile(startPrint).subscribe((result) => this.onSuccessfulPostFile(result),
      (errors: any) => this.onUnsuccessful(errors)
    );
  }

  postFile(startPrint: boolean): Observable<any> {
    this.uploadIsEnabled = false;
    this.printIsEnabled = false;
    this.removeIsEnabled = false;

    let headers = new Headers();
    //headers.append('Content-Type', 'multipart/form-data');
    headers.append('X-Api-Key', this.opArgs.ApiKey);
    let requestOptions = new RequestOptions({ headers: headers });

    let data: FormData = new FormData();
    data.append('file', this.opArgs.File, this.opArgs.FileName);
    if (startPrint) {
      data.append('select', 'true');
      data.append('print', 'true');
    }
    console.log(data);
    return this.http.post(this.opArgs.Host + '/api/files/local', data, requestOptions)
      .map((res: Response) => res.json());
  }

  onSuccessfulPostFile(result): void {
    if (this.removeSource) {
      this.fs.unlink(this.opArgs.Path + this.opArgs.FileName, (err) => {
        if (err) {
          console.log('failed to delete local file:' + err);
        } else {
          console.log('successfully deleted local file');
        }
      });
    }
    this.exit(true);
  }

  onUnsuccessful(errors): void {
    if (!errors.status) {
      this.status = 'OctoPrint is offline or there is a invalid parameter.';
    } else if (errors.status === 400) {
      this.status = 'Invalid Request.';
    } else if (errors.status === 404) {
      this.status = 'Location not found.';
    } else if (errors.status === 409) {
      this.status = 'Same File Name as the file that is printing.';
    } else if (errors.status === 415) {
      this.status = 'Invalid gcode in file.';
    } else if (errors.status === 500) {
      this.status = 'File upload failed.';
    }
  }

  exit(OpenOp: boolean) {
    if (OpenOp) {
      this.es.shell.openExternal(this.opArgs.Host);
    }
    this.es.remote.app.exit();
  }

  remove() {
    if (!this.removeIsEnabled) { return; }

    this.removeSource = !this.removeSource;

  }

  upload() {
    if (!this.uploadIsEnabled) { return; }

    this.pushFile(false);
  }

  print() {
    if (!this.printIsEnabled) { return; }

    this.pushFile(true);
  }

  close() {
    this.exit(false);
  }

  protected handleError(error: any) {
    let applicationError = error.headers.get('Application-Error');

    // either applicationError in header or model error in body
    if (applicationError) {
      return Observable.throw(applicationError);
    }

    let modelStateErrors: string | null = '';
    let serverError = error.json();

    if (!serverError.type) {
      for (let key in serverError) {
        if (serverError.hasOwnProperty(key)) {
          if (serverError[key]) {
            modelStateErrors += serverError[key] + '\n';
          }
        }
      }
    }

    modelStateErrors = modelStateErrors === "" ? null : modelStateErrors;
    return Observable.throw(modelStateErrors || "Server error");
  }
}

@NgModule({
  imports: [
    BrowserModule,
    HttpModule,
    NgxElectronModule
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule { }