#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <pty.h>
#include <unistd.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <signal.h>
#include <vector>
#include <string>
#include <array>
#include <optional>

struct Cell { char ch=' '; SDL_Color fg{80,255,120,255}; };

class TerminalBuffer {
public:
  TerminalBuffer(int c,int r):cols(c),rows(r),cells(c*r){}
  void put(char c){
    if(c=='\n'){cx=0; cy++; clampScroll(); return;}
    if(c=='\r'){cx=0; return;}
    if(c==8 || c==127){ if(cx>0){cx--; at(cx,cy).ch=' ';} return; }
    if((unsigned char)c<32) return;
    at(cx,cy).ch=c; cx++; if(cx>=cols){cx=0; cy++; clampScroll();}
  }
  void clear(){ for(auto& c:cells){c.ch=' '; c.fg={80,255,120,255};} cx=cy=0; }
  Cell& at(int x,int y){ return cells[y*cols+x]; }
  const Cell& at(int x,int y) const { return cells[y*cols+x]; }
  int x() const{return cx;} int y() const{return cy;} int width() const{return cols;} int height() const{return rows;}
private:
  int cols,rows,cx=0,cy=0; std::vector<Cell> cells;
  void clampScroll(){ if(cy<rows) return; for(int y=1;y<rows;y++) for(int x=0;x<cols;x++) at(x,y-1)=at(x,y); for(int x=0;x<cols;x++) at(x,rows-1).ch=' '; cy=rows-1; }
};

class PtyShell {
public:
  bool start(const char* shell="/bin/bash"){
    pid=forkpty(&mfd,nullptr,nullptr,nullptr);
    if(pid==0){ execl(shell,"bash","-i",nullptr); _exit(1);} 
    if(pid<0) return false;
    fcntl(mfd,F_SETFL,O_NONBLOCK);
    return true;
  }
  ~PtyShell(){ stop(); }
  void stop(){ if(pid>0){ kill(pid,SIGTERM); waitpid(pid,nullptr,0); pid=-1;} if(mfd>=0){ close(mfd); mfd=-1; } }
  ssize_t readSome(char* b,size_t n){ return mfd>=0?read(mfd,b,n):-1; }
  void writeBytes(const char* b,size_t n){ if(mfd>=0) ::write(mfd,b,n); }
private: pid_t pid=-1; int mfd=-1;
};

class SdlTermApp {
public:
  bool init(){
    if(SDL_Init(SDL_INIT_VIDEO)!=0) return false;
    if(TTF_Init()!=0) return false;
    win=SDL_CreateWindow("LCD Linux Terminal Emulator",SDL_WINDOWPOS_CENTERED,SDL_WINDOWPOS_CENTERED,cols*cw,rows*ch,SDL_WINDOW_RESIZABLE);
    ren=SDL_CreateRenderer(win,-1,SDL_RENDERER_ACCELERATED|SDL_RENDERER_PRESENTVSYNC);
    font=TTF_OpenFont("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",18);
    if(!win||!ren||!font) return false;
    return shell.start();
  }
  void run(){
    SDL_StartTextInput();
    bool running=true; Uint32 lastBlink=0; bool cursorOn=true;
    while(running){
      SDL_Event e;
      while(SDL_PollEvent(&e)){
        if(e.type==SDL_QUIT) running=false;
        else if(e.type==SDL_TEXTINPUT) shell.writeBytes(e.text.text,strlen(e.text.text));
        else if(e.type==SDL_KEYDOWN) handleKey(e.key.keysym.sym);
      }
      pumpPty();
      if(SDL_GetTicks()-lastBlink>420){cursorOn=!cursorOn; lastBlink=SDL_GetTicks();}
      render(cursorOn);
      SDL_Delay(6);
    }
  }
  ~SdlTermApp(){ if(font)TTF_CloseFont(font); if(ren)SDL_DestroyRenderer(ren); if(win)SDL_DestroyWindow(win); TTF_Quit(); SDL_Quit(); }
private:
  int cols=96,rows=30,cw=13,ch=22;
  SDL_Window* win=nullptr; SDL_Renderer* ren=nullptr; TTF_Font* font=nullptr;
  TerminalBuffer term{cols,rows}; PtyShell shell;

  void handleKey(SDL_Keycode k){
    if(k==SDLK_BACKSPACE){ char c=127; shell.writeBytes(&c,1); }
    else if(k==SDLK_RETURN){ char c='\n'; shell.writeBytes(&c,1); }
    else if(k==SDLK_TAB){ char c='\t'; shell.writeBytes(&c,1); }
    else if(k==SDLK_ESCAPE){ char c=27; shell.writeBytes(&c,1); }
  }
  void pumpPty(){
    char b[4096]; ssize_t n=0;
    while((n=shell.readSome(b,sizeof(b)))>0){ for(ssize_t i=0;i<n;i++) term.put(b[i]); }
  }
  void render(bool cursorOn){
    SDL_SetRenderDrawColor(ren,4,8,12,255); SDL_RenderClear(ren);
    for(int y=0;y<rows;y++) for(int x=0;x<cols;x++){
      const Cell& c=term.at(x,y); if(c.ch==' ') continue;
      char s[2]={c.ch,0}; SDL_Surface* sf=TTF_RenderText_Blended(font,s,c.fg); if(!sf) continue;
      SDL_Texture* tx=SDL_CreateTextureFromSurface(ren,sf);
      SDL_Rect d{x*cw,y*ch,sf->w,sf->h}; SDL_RenderCopy(ren,tx,nullptr,&d);
      SDL_FreeSurface(sf); SDL_DestroyTexture(tx);
    }
    if(cursorOn){ SDL_Rect cur{term.x()*cw, term.y()*ch+ch-2, cw,2}; SDL_SetRenderDrawColor(ren,80,255,120,255); SDL_RenderFillRect(ren,&cur); }
    SDL_RenderPresent(ren);
  }
};

int main(){ SdlTermApp app; if(!app.init()) return 1; app.run(); return 0; }
