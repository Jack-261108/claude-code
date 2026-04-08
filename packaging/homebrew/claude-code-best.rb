class ClaudeCodeBest < Formula
  desc "Reverse-engineered Anthropic Claude Code CLI"
  homepage "https://github.com/Jack-261108/claude-code"
  version "2.1.888"
  depends_on "bun"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/Jack-261108/claude-code/releases/download/v2.1.888/ccb-v2.1.888-darwin-arm64.tar.gz"
      sha256 "30f5416ce12a9689c4d99a46392af3f9cd16577c4c198aa2efb5faccda364420"
    else
      url "https://github.com/Jack-261108/claude-code/releases/download/v2.1.888/ccb-v2.1.888-darwin-x64.tar.gz"
      sha256 "eb3a78ac5bdc3407acc9271ecdd660d0e8ce25aaa62eaa3d25373205705e1c8c"
    end
  end

  def install
    libexec.install Dir["*"]
    root = libexec.children.find(&:directory?)
    raise "release root directory missing" unless root
    bin.install_symlink root/"bin/ccb"
    bin.install_symlink root/"bin/claude-code-best"
  end

  test do
    output = shell_output("#{bin}/ccb --version")
    assert_match "Claude Code", output
  end
end
