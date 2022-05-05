import {DataGrid} from '@vscode/webview-ui-toolkit';

window.addEventListener('message', (event) => {
  const message = event.data; // The JSON data our extension sent

  const div = document.getElementById('table-div') as HTMLDivElement;
  div.innerHTML = '';
  const table = document.createElement('table');

  let memory = message.body.memory as number[];


  let titleRow = document.createElement('tr');
  titleRow.append(document.createElement('th'));
  for(let i = 0; i < 16; i++){
    let th = document.createElement('th');
    th.innerText = i.toString(16);
    titleRow.appendChild(th);
  }
  table.appendChild(titleRow);
  for(let y = 0; y < 16; y++){
      let row = document.createElement('tr');
      let th = document.createElement('th');
      th.innerText = y.toString(16);
      row.appendChild(th);
      for(let x = 0; x < 16; x++){
          let td = document.createElement('td');
          let address = y*16 + x;
          let value = memory[address];

          td.innerText = value.toString(16).padStart(2, '0');
          if (address === message.body.registers.sp){
            td.classList.add('stack-cell');
          }
          row.appendChild(td);
      }
      table.appendChild(row);
  }
  
  div.appendChild(table);
});
