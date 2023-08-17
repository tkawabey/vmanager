#include <node.h>
#include <v8.h>
#include <windows.h>
#include <shobjidl.h>
#include <objbase.h>
#include <shlobj.h>
#include <shellapi.h>
#include <string>
#include <iostream>


using namespace node;
using namespace v8;



void ThrowTypeError(v8::Isolate *isolate, const char* msg)
{
    size_t msgSize = std::strlen(msg);
    v8::Local<v8::String> v8Msg =
        v8::String::NewFromUtf8(isolate, msg, v8::NewStringType::kNormal, static_cast<int>(msgSize)).ToLocalChecked();

    // Throw an Error that is passed back to JavaScript
    isolate->ThrowException(v8::Exception::TypeError(v8Msg));
}


// Given a shortcut path, get the path of the link destination
void getAbsoltePath(const FunctionCallbackInfo<Value>& args) {

    Isolate *isolate = args.GetIsolate();
    v8::Local<v8::Context> context = v8::Context::New(v8::Isolate::GetCurrent());


    // Check the number of arguments passed.
    if ( args.Length() < 1 ) {
        ThrowTypeError(isolate, "Wrong number of arguments");
        return;
    }
    if( args[0]->IsString() == false )
    {
        ThrowTypeError(isolate, "arg1 is invalid type.");
        return;
    }
    MaybeLocal<v8::String>  strMaybeLocalLink = args[0]->ToString(context);
    v8::Local<v8::String> localStringLink ;
    if (strMaybeLocalLink.ToLocal(&localStringLink) == false ) {
        ThrowTypeError(isolate, "invalid type.");
        return;
    }
    v8::String::Value unicodeValueLink(context->GetIsolate(), localStringLink);
    const uint16_t* unicodeStrLink = *unicodeValueLink;

    IShellLinkW* pShellLink = NULL;
    HRESULT hr = CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (LPVOID*)&pShellLink);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to CoCreateInstance.");
        return;
    }
    IPersistFile* pPersistFile;
    hr = pShellLink->QueryInterface(IID_IPersistFile, (LPVOID*)&pPersistFile);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to QueryInterface.");
        pShellLink->Release();        
        return;
    }


    LPCWSTR shortcutPath = (LPCWSTR)unicodeStrLink;
    hr = pPersistFile->Load(shortcutPath, STGM_READ);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to Load.");
        pPersistFile->Release();
        pShellLink->Release();        
        return;
    }
    WCHAR targetPath[MAX_PATH];
    WIN32_FIND_DATAW  findData;
    hr = pShellLink->GetPath(targetPath, MAX_PATH, &findData, SLGP_RAWPATH);
    pPersistFile->Release();
    pShellLink->Release();
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to GetPath.");
        return;
    }


    HandleScope scope(isolate);
    Local<v8::String> result;
    MaybeLocal<v8::String> str = String::NewFromTwoByte (isolate, (const uint16_t *)targetPath);
    str.ToLocal(&result);
    args.GetReturnValue().Set(result);
}

// Change the destination path of the shortcut.
void setAbsoltePath(const FunctionCallbackInfo<Value>& args) {
    Isolate *isolate = args.GetIsolate();
    v8::Local<v8::Context> context = v8::Context::New(v8::Isolate::GetCurrent());


    // Check the number of arguments passed.
    if ( args.Length() < 2 ) {
        ThrowTypeError(isolate, "Wrong number of arguments");
        return;
    }
    if( args[0]->IsString() == false )
    {
        ThrowTypeError(isolate, "arg1 is invalid type.");
        return;
    }
    if( args[1]->IsString() == false )
    {
        ThrowTypeError(isolate, "arg2 is invalid type.");
        return;
    }
    MaybeLocal<v8::String>  strMaybeLocalLink = args[0]->ToString(context);
    MaybeLocal<v8::String>  strMaybeLocalAbs = args[1]->ToString(context);
    v8::Local<v8::String> localStringLink;
    v8::Local<v8::String> localStringAbs;
    if (strMaybeLocalLink.ToLocal(&localStringLink) == false ) {
        ThrowTypeError(isolate, "invalid type.");
        return;
    }
    if (strMaybeLocalAbs.ToLocal(&localStringAbs) == false ) {
        ThrowTypeError(isolate, "invalid type.");
        return;
    }
    v8::String::Value unicodeValueLink(context->GetIsolate(), localStringLink);
    v8::String::Value unicodeValueAbs (context->GetIsolate(), localStringAbs);
    const uint16_t* unicodeStrLink = *unicodeValueLink;
    const uint16_t* unicodeStrAbs  = *unicodeValueAbs;

    IShellLinkW* pShellLink = NULL;
    HRESULT hr = CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (LPVOID*)&pShellLink);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to CoCreateInstance.");
        return;
    }
    IPersistFile* pPersistFile;
    hr = pShellLink->QueryInterface(IID_IPersistFile, (LPVOID*)&pPersistFile);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to QueryInterface.");
        pShellLink->Release();        
        return;
    }


    LPCWSTR shortcutPath = (LPCWSTR)unicodeStrLink;
    hr = pPersistFile->Load(shortcutPath, STGM_READ);
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to Load.");
        pPersistFile->Release();
        pShellLink->Release();        
        return;
    }
    hr = pShellLink->SetPath((LPCWSTR)unicodeStrAbs);
    if ( !SUCCEEDED(hr)) {
        pPersistFile->Release();
        pShellLink->Release();
        ThrowTypeError(isolate, "fail to SetPath.");
        return;
    }
    hr = pPersistFile->Save(shortcutPath, TRUE);
    pPersistFile->Release();
    pShellLink->Release();        
    if ( !SUCCEEDED(hr)) {
        ThrowTypeError(isolate, "fail to Save.");
        return;
    }

    args.GetReturnValue().Set(true);
}


void init(Local<Object> exports) {
    // COM initialization
    CoInitialize(NULL);

    NODE_SET_METHOD(exports, "getAbsoltePath", getAbsoltePath);
    NODE_SET_METHOD(exports, "setAbsoltePath", setAbsoltePath);
}




NODE_MODULE(NODE_GYP_MODULE_NAME, init)