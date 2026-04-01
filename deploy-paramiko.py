import os
import paramiko

host = '192.168.1.77'
user = 'sinco'

local_dir = r"C:\Users\adm\Desktop\MetalFisa Anty\linux-deployment"
remote_dir = '/var/www/metalfisa'

def deploy():
    try:
        print(f"Connecting to {host} via SSH (Paramiko Ed25519 Key)...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Load the ed25519 key
        key = paramiko.Ed25519Key.from_private_key_file(r"C:\Users\adm\.ssh\id_ed25519_metalfisa")
        ssh.connect(host, username=user, pkey=key)
        print("Connected. Opening SFTP...")
        
        sftp = ssh.open_sftp()
        print(f"Uploading from {local_dir} to {remote_dir}...")
        
        for root, dirs, files in os.walk(local_dir):
            remote_root = root.replace(local_dir, remote_dir).replace('\\', '/')
            try:
                sftp.stat(remote_root)
            except IOError:
                sftp.mkdir(remote_root)

            for f in files:
                local_file = os.path.join(root, f)
                remote_file = os.path.join(remote_root, f).replace('\\', '/')
                sftp.put(local_file, remote_file)
                
        print("Upload finished. Restarting PM2...")
        stdin, stdout, stderr = ssh.exec_command("cd /var/www/metalfisa/server && pm2 restart all")
        
        print("STDOUT:", stdout.read().decode())
        print("STDERR:", stderr.read().decode())
        
        sftp.close()
        ssh.close()
        print("Deployment Complete!")
        
    except Exception as e:
        print(f"Deploy Error: {e}")

if __name__ == '__main__':
    deploy()
